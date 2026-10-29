import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db
from ...db.models import AuditEvent, AWSAccount, CloudResource, User
from ..deps import get_current_user, assert_account_access, is_demo_account_id

router = APIRouter(prefix="/activity", tags=["Audit & Activity Logs"])

SYNTHESIS_AUDIT_LOGS = [
    {
        "id": "audit_01",
        "timestamp": "2026-10-25 10:45:12 UTC",
        "actor": "finops-lead@cloudsense.ai",
        "actorRole": "admin",
        "action": "MODIFY_INSTANCE_TYPE",
        "resourceId": "i-08a9f24c7b8e1a3d",
        "environment": "production",
        "result": "success",
        "correlationId": "mcp-corr-98214",
        "details": "Downsized prod-analytics-worker-01 from c5.4xlarge to c5.2xlarge via Boto3. Savings $482/mo."
    },
    {
        "id": "audit_02",
        "timestamp": "2026-10-25 09:20:05 UTC",
        "actor": "cloudsense-agent-dow",
        "actorRole": "finops_analyst",
        "action": "EVALUATE_ISOLATION_FOREST",
        "resourceId": "arn:aws:lambda:us-east-1:123456789012:function:checkout-payment-handler",
        "environment": "production",
        "result": "warning",
        "correlationId": "mcp-corr-98102",
        "details": "Isolation Forest flagged score 14.82 > 11.25 threshold. Triage classified as dow_candidate."
    },
    {
        "id": "audit_03",
        "timestamp": "2026-10-24 18:15:30 UTC",
        "actor": "system-boto3-collector",
        "actorRole": "cloud_engineer",
        "action": "INGEST_AWS_CUR",
        "resourceId": "s3://cloudsense-billing-cur-exports-us-east-1/cur2.0/",
        "environment": "production",
        "result": "success",
        "correlationId": "mcp-corr-97840",
        "details": "Successfully ingested daily telemetry from AWS Cost and Usage Reports."
    },
    {
        "id": "audit_04",
        "timestamp": "2026-10-24 14:02:19 UTC",
        "actor": "governance-reviewer@cloudsense.ai",
        "actorRole": "cloud_engineer",
        "action": "APPROVE_POLICY_OVERRIDE",
        "resourceId": "asg-ml-data-pipeline",
        "environment": "staging",
        "result": "success",
        "correlationId": "mcp-corr-97621",
        "details": "Approved scale down of idle worker nodes after batch task completion."
    }
]

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def get_audit_logs(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve immutable audit and activity log entries from the database."""
    account = assert_account_access(account_id, current_user, db) if account_id else None
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    is_demo = is_demo_account_id(scoped_id) or bool(account and account.is_demo)

    db_events = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).all()
    if not is_demo and account_id:
        acc_resource_ids = {r.resource_id for r in db.query(CloudResource).filter(CloudResource.account_id == account_id).all()}
        db_events = [ev for ev in db_events if ev.target in acc_resource_ids or account_id in ev.target or account_id in (ev.details_json or "")]
    results = []

    for ev in db_events:
        details_str = ev.action
        try:
            if ev.details_json:
                d_obj = json.loads(ev.details_json)
                details_str = d_obj.get("details") or f"Executed {ev.action} on {ev.target}"
        except Exception:
            pass

        results.append({
            "id": ev.event_id,
            "timestamp": ev.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if ev.timestamp else "Recently",
            "actor": ev.actor,
            "actorRole": "admin" if "lead" in ev.actor.lower() else "cloud_engineer",
            "action": ev.action,
            "resourceId": ev.target,
            "environment": "production",
            "result": ev.status.lower(),
            "correlationId": f"mcp-corr-{ev.event_id[-5:]}",
            "details": details_str
        })

    # Only append synthesis benchmark logs in demo lab mode
    if is_demo:
        for item in SYNTHESIS_AUDIT_LOGS:
            if not any(r["id"] == item["id"] for r in results):
                results.append(item)

    return results
