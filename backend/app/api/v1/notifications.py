from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/notifications", tags=["Notifications"])

NOTIFICATIONS_STORE = [
    {
        "id": "notif_01",
        "type": "dow",
        "title": "Critical: Denial-of-Wallet Wave Detected",
        "description": "Lambda checkout API undergoing abnormal request volume without transaction conversions (+420% cost velocity).",
        "severity": "critical",
        "timestamp": "14 minutes ago",
        "read": False,
        "actionUrl": "/anomalies-dow"
    },
    {
        "id": "notif_02",
        "type": "forecast",
        "title": "Prophet Forecast: Budget Overrun Warning",
        "description": "Projected month-end burn of $14,840.50 will exceed current budget limit ($14,500.00) around Day 24.",
        "severity": "warning",
        "timestamp": "1 hour ago",
        "read": False,
        "actionUrl": "/cost-forecast"
    },
    {
        "id": "notif_03",
        "type": "approval",
        "title": "3 New FinOps Recommendations Pending Approval",
        "description": "Review proposals to downsize analytics workers and clean detached EBS volumes to save $1,288/mo.",
        "severity": "high",
        "timestamp": "2 hours ago",
        "read": True,
        "actionUrl": "/approvals"
    },
    {
        "id": "notif_04",
        "type": "remediation",
        "title": "MCP Execution Succeeded",
        "description": "Downsized i-08a9f24c7b8e1a3d to c5.2xlarge. CloudWatch health checks confirmed nominal throughput.",
        "severity": "low",
        "timestamp": "Yesterday",
        "read": True,
        "actionUrl": "/remediation-center"
    }
]

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_notifications():
    return NOTIFICATIONS_STORE

@router.post("/{notif_id}/read")
def mark_read(notif_id: str):
    for n in NOTIFICATIONS_STORE:
        if n["id"] == notif_id:
            n["read"] = True
            return {"success": True}
    return {"success": False}
