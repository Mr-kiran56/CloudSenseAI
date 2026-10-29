import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ...db.session import get_db
from ...db.models import Notification, AWSAccount, User
from ..deps import get_current_user, assert_account_access, is_demo_account_id

router = APIRouter(prefix="/notifications", tags=["Notifications"])

INITIAL_NOTIFICATIONS = [
    {
        "title": "Critical: Denial-of-Wallet Wave Detected",
        "message": "Lambda checkout API undergoing abnormal request volume without transaction conversions (+420% cost velocity).",
        "severity": "critical",
        "category": "dow",
        "read": False,
        "link": "/anomalies-dow"
    },
    {
        "title": "Prophet Forecast: Budget Overrun Warning",
        "message": "Projected month-end burn of $14,840.50 will exceed current budget limit ($14,500.00) around Day 24.",
        "severity": "warning",
        "category": "forecast",
        "read": False,
        "link": "/cost-forecast"
    },
    {
        "title": "3 New FinOps Recommendations Pending Approval",
        "message": "Review proposals to downsize analytics workers and clean detached EBS volumes to save $1,288/mo.",
        "severity": "high",
        "category": "approval",
        "read": True,
        "link": "/approvals"
    },
    {
        "title": "MCP Execution Succeeded",
        "message": "Downsized i-08a9f24c7b8e1a3d to c5.2xlarge. CloudWatch health checks confirmed nominal throughput.",
        "severity": "low",
        "category": "remediation",
        "read": True,
        "link": "/remediation-center"
    }
]

def _ensure_initial_notifications(db: Session):
    count = db.query(Notification).count()
    if count == 0:
        for item in INITIAL_NOTIFICATIONS:
            notif = Notification(
                title=item["title"],
                message=item["message"],
                severity=item["severity"],
                category=item["category"],
                read=item["read"],
                link=item["link"],
                created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
            )
            db.add(notif)
        db.commit()

def _format_notification(n: Notification) -> Dict[str, Any]:
    # Human-friendly timestamp
    if n.created_at:
        now = datetime.datetime.utcnow()
        diff = now - n.created_at
        if diff.total_seconds() < 60:
            ts_str = "Just now"
        elif diff.total_seconds() < 3600:
            ts_str = f"{int(diff.total_seconds() // 60)}m ago"
        elif diff.total_seconds() < 86400:
            ts_str = f"{int(diff.total_seconds() // 3600)}h ago"
        else:
            ts_str = n.created_at.strftime("%b %d, %H:%M UTC")
    else:
        ts_str = "Recently"

    return {
        "id": f"notif_{n.id}",
        "dbId": n.id,
        "title": n.title,
        "description": n.message,
        "message": n.message,
        "severity": n.severity or "info",
        "type": n.category or "system",
        "category": n.category or "system",
        "timestamp": ts_str,
        "read": bool(n.read),
        "link": n.link or "",
        "actionUrl": n.link or "",
        "createdAt": n.created_at.isoformat() if n.created_at else None
    }

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_notifications(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all notifications from database ordered newest first."""
    account = assert_account_access(account_id, current_user, db) if account_id else None
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    is_demo = is_demo_account_id(scoped_id) or bool(account and account.is_demo)

    if is_demo:
        _ensure_initial_notifications(db)
        items = db.query(Notification).filter(
            (Notification.user_id == current_user.id) | (Notification.user_id == None)  # noqa: E711
        ).order_by(Notification.created_at.desc()).all()
        return [_format_notification(n) for n in items]

    # For live AWS account: return alerts scoped to this account ID or user
    items = db.query(Notification).filter(
        (Notification.user_id == current_user.id) | (Notification.account_id == scoped_id) | (Notification.user_id == None)  # noqa: E711
    ).order_by(Notification.created_at.desc()).all()
    live_items = [n for n in items if not scoped_id or (scoped_id in (n.message or "") or scoped_id in (n.link or "") or n.account_id == scoped_id)]
    return [_format_notification(n) for n in live_items]

class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    severity: str = "info"
    category: str = "system"
    link: Optional[str] = None
    account_id: Optional[str] = None

@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any])
def create_notification(
    req: CreateNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new notification entry in SQLite."""
    n = Notification(
        user_id=current_user.id,
        account_id=req.account_id,
        title=req.title,
        message=req.message,
        severity=req.severity,
        category=req.category,
        read=False,
        link=req.link,
        created_at=datetime.datetime.utcnow()
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _format_notification(n)

@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read in SQLite."""
    db.query(Notification).filter(
        (Notification.user_id == current_user.id) | (Notification.user_id == None)  # noqa: E711
    ).update({Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"success": True, "message": "All notifications marked as read."}

@router.post("/{notif_id}/read")
def mark_read(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read in SQLite."""
    clean_id = notif_id.replace("notif_", "")
    target = None
    if clean_id.isdigit():
        target = db.query(Notification).filter(Notification.id == int(clean_id)).first()

    if not target:
        # Fallback query
        target = db.query(Notification).filter(Notification.title.ilike(f"%{notif_id}%")).first()

    if target:
        target.read = True
        db.commit()
        return {"success": True}

    return {"success": False, "message": "Notification not found."}

@router.delete("/{notif_id}")
def delete_notification(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a notification from SQLite."""
    clean_id = notif_id.replace("notif_", "")
    if clean_id.isdigit():
        target = db.query(Notification).filter(Notification.id == int(clean_id)).first()
        if target:
            db.delete(target)
            db.commit()
            return {"success": True}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
