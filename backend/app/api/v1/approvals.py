import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...db.session import get_db
from ...db.schemas import ApprovalDecisionRequest
from ...mcp.policies import generate_action_hash
from .recommendations import RECOMMENDATIONS_STORE
from .integrations import dispatch_notification_to_webhooks

router = APIRouter(prefix="/approvals", tags=["Human Approvals"])

APPROVALS_STORE: List[Dict[str, Any]] = [
    {
        "id": "appr_01",
        "recommendationId": "rec_01_ec2_resize",
        "title": "Downsize Analytics Worker c5.4xlarge -> c5.2xlarge",
        "resourceId": "i-08a9f24c7b8e1a3d",
        "resourceName": "prod-analytics-worker-01",
        "risk": "low",
        "estimatedSavings": 482.00,
        "requester": "CloudSense FinOps Engine",
        "requestedAt": "2 hours ago",
        "expiresAt": "in 46 hours",
        "status": "pending",
        "evidenceSummary": "Average CPU 14.2%, P95 CPU 22.8%, Memory 9.4 GiB out of 32 GiB. Verified non-critical async ETL tier."
    },
    {
        "id": "appr_02",
        "recommendationId": "rec_02_idle_sandbox",
        "title": "Terminate Stale Research ML Instance (g4dn.xlarge)",
        "resourceId": "i-09f182c448bb92aa",
        "resourceName": "dev-sandbox-ml-train",
        "risk": "low",
        "estimatedSavings": 412.00,
        "requester": "CloudSense FinOps Engine",
        "requestedAt": "5 hours ago",
        "expiresAt": "in 43 hours",
        "status": "pending",
        "evidenceSummary": "19 days idle with < 1% CPU and zero GPU compute kernel executions. Snapshot backup verified."
    },
    {
        "id": "appr_03",
        "recommendationId": "rec_03_unattached_ebs",
        "title": "Purge 6 Orphaned gp3 EBS Volumes (2,400 GB)",
        "resourceId": "vol-0e78291f09bb2a4c1",
        "resourceName": "unattached-db-backup-gp3",
        "risk": "low",
        "estimatedSavings": 394.00,
        "requester": "CloudSense FinOps Engine",
        "requestedAt": "1 day ago",
        "expiresAt": "in 23 hours",
        "status": "pending",
        "evidenceSummary": "Detached for 21 days following Kubernetes cluster node retirement. Verified zero mount operations."
    }
]

REMEDIATION_JOBS_STORE: List[Dict[str, Any]] = [
    {
        "id": "rem_job_init_01",
        "recommendationId": "rec_01_ec2_resize",
        "actionName": "Modify EC2 Instance Type (Downsize)",
        "resourceId": "i-08a9f24c7b8e1a3d",
        "resourceName": "prod-analytics-worker-01",
        "requestedBy": "CloudSense Engine",
        "approvedBy": "FinOps Lead (Kiran)",
        "status": "completed",
        "executionId": "exec-mcp-92a01",
        "startedAt": "Yesterday at 16:30 UTC",
        "completedAt": "Yesterday at 16:33 UTC",
        "resultSummary": "Successfully modified instance type from c5.4xlarge to c5.2xlarge via Boto3. Verified health check status 2/2.",
        "executionTimeline": [
            {"step": "Policy Validation", "agent": "MCP Policy Engine", "timestamp": "16:30:10 UTC", "status": "success", "detail": "Verified allowlist policy and least-privilege IAM credentials"},
            {"step": "Instance Stop & Reconfigure", "agent": "Boto3 Cloud Orchestrator", "timestamp": "16:31:05 UTC", "status": "success", "detail": "Clean instance shutdown and instance_type attribute modification"},
            {"step": "Instance Restart & Verification", "agent": "CloudWatch Monitor", "timestamp": "16:33:00 UTC", "status": "success", "detail": "Instance online, P95 CPU stable at 38.2%"}
        ]
    }
]

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_approvals(db: Session = Depends(get_db)):
    return APPROVALS_STORE

@router.post("/{approval_id}/decision")
def make_decision(approval_id: str, req: ApprovalDecisionRequest, db: Session = Depends(get_db)):
    for appr in APPROVALS_STORE:
        if appr["id"] == approval_id:
            appr["status"] = req.decision
            
            # If approved, generate remediation job
            if req.decision == "approved":
                new_job = {
                    "id": f"rem_job_{uuid.uuid4().hex[:6]}",
                    "recommendationId": appr["recommendationId"],
                    "actionName": appr["title"],
                    "resourceId": appr["resourceId"],
                    "resourceName": appr["resourceName"],
                    "requestedBy": appr["requester"],
                    "approvedBy": req.approverName or "FinOps Lead",
                    "status": "completed",
                    "executionId": f"exec-mcp-{uuid.uuid4().hex[:6]}",
                    "startedAt": "Just now",
                    "completedAt": "Just now",
                    "resultSummary": f"MCP Boto3 engine completed execution of {appr['title']} with zero operational errors.",
                    "executionTimeline": [
                        {"step": "Human Approval Verification", "agent": "MCP Policy Engine", "timestamp": "Just now", "status": "success", "detail": f"Signed approval recorded by {req.approverName or 'FinOps Lead'}"},
                        {"step": "Boto3 State Transition", "agent": "Boto3 Runner", "timestamp": "Just now", "status": "success", "detail": "Cloud state successfully updated on target resource"},
                        {"step": "Telemetry Health Checks", "agent": "CloudWatch Agent", "timestamp": "Just now", "status": "success", "detail": "Verified 2/2 system status checks passed"}
                    ]
                }
                REMEDIATION_JOBS_STORE.insert(0, new_job)
                
                # Update recommendation state
                for r in RECOMMENDATIONS_STORE:
                    if r["id"] == appr["recommendationId"]:
                        r["status"] = "executed"

                # Dispatch notification to webhooks
                dispatch_notification_to_webhooks(
                    event_type="approval",
                    title=f"FinOps Action Executed: {appr['title']}",
                    description=f"Action on {appr['resourceId']} approved by {req.approverName or 'FinOps Lead'}. Remediation completed.",
                    data={"approval_id": approval_id, "resource_id": appr["resourceId"], "savings": appr["estimatedSavings"]}
                )
                        
            return {"success": True, "approval": appr}
            
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval item not found.")
