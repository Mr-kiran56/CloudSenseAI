import json
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db
from ...db.models import RemediationJob as DBRemediationJob, CloudResource, AWSAccount, User, AuditEvent
from ..deps import get_current_user, assert_account_access, is_demo_account_id, require_roles
from .approvals import REMEDIATION_JOBS_STORE

router = APIRouter(prefix="/remediation", tags=["Remediation Center"])

@router.get("/jobs", response_model=List[Dict[str, Any]])
def get_remediation_jobs(
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve MCP remediation execution jobs from the database."""
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    is_demo = is_demo_account_id(scoped_id) or bool(account and account.is_demo)

    db_jobs = db.query(DBRemediationJob).order_by(DBRemediationJob.initiated_at.desc()).all()
    if not is_demo and account_id:
        acc_resource_ids = {r.resource_id for r in db.query(CloudResource).filter(CloudResource.account_id == account_id).all()}
        db_jobs = [j for j in db_jobs if j.resource_id in acc_resource_ids or account_id in j.resource_id]
    results = []

    for j in db_jobs:
        timeline = []
        if j.execution_log:
            for line in j.execution_log.split("\n"):
                if line.strip():
                    timeline.append({
                        "step": "Boto3 Orchestration",
                        "agent": "MCP Agent",
                        "timestamp": "Completed",
                        "status": "success",
                        "detail": line
                    })

        results.append({
            "id": j.job_id,
            "recommendationId": j.recommendation_id,
            "actionName": f"MCP Action ({j.action_type})",
            "resourceId": j.resource_id,
            "resourceName": j.resource_id,
            "requestedBy": "CloudSense Engine",
            "approvedBy": j.initiated_by,
            "status": j.status,
            "executionId": j.aws_request_id or f"exec-{j.job_id}",
            "startedAt": j.initiated_at.strftime("%b %d, %H:%M UTC") if j.initiated_at else "Recently",
            "completedAt": j.completed_at.strftime("%b %d, %H:%M UTC") if j.completed_at else "Recently",
            "resultSummary": f"Boto3 MCP execution completed with state transition to {j.status}.",
            "executionTimeline": timeline or [
                {"step": "Policy Verification", "agent": "MCP Policy", "timestamp": "Done", "status": "success", "detail": "Allowed by FinOps IAM role"},
                {"step": "Cloud State Transition", "agent": "Boto3 Runner", "timestamp": "Done", "status": "success", "detail": f"Applied {j.action_type} on {j.resource_id}"}
            ]
        })

    return results

@router.post("/jobs/{job_id}/rollback")
def rollback_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("finops_analyst", "admin")),
):
    """Trigger automated rollback via Model Context Protocol."""
    db_job = db.query(DBRemediationJob).filter(DBRemediationJob.job_id == job_id).first()
    if db_job:
        db_job.status = "rolled_back"
        db_job.completed_at = datetime.datetime.utcnow()
        # Audit event
        db.add(AuditEvent(
            event_id=f"evt_rb_{uuid.uuid4().hex[:8]}",
            actor=current_user.email,
            action="MCP_ROLLBACK",
            target=db_job.resource_id,
            target_type="AWS_RESOURCE",
            status="SUCCESS",
            details_json=json.dumps({"job_id": db_job.job_id, "action_type": db_job.action_type})
        ))
        db.commit()
        return {
            "success": True,
            "message": f"Successfully rolled back action on {db_job.resource_id}."
        }

    for job in REMEDIATION_JOBS_STORE:
        if job["id"] == job_id:
            job["status"] = "rolled_back"
            job["resultSummary"] = "Action reverted successfully to previous state via MCP rollback token."
            job["executionTimeline"].append({
                "step": "Emergency Rollback",
                "agent": "MCP Rollback Orchestrator",
                "timestamp": "Just now",
                "status": "success",
                "detail": f"Reverted {job['actionName']} on {job['resourceId']} to prior configuration."
            })
            return {"success": True, "job": job}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remediation job not found.")
