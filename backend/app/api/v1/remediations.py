from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...db.session import get_db
from .approvals import REMEDIATION_JOBS_STORE

router = APIRouter(prefix="/remediation", tags=["Remediation Center"])

@router.get("/jobs", response_model=List[Dict[str, Any]])
def get_remediation_jobs(db: Session = Depends(get_db)):
    return REMEDIATION_JOBS_STORE

@router.post("/jobs/{job_id}/rollback")
def rollback_job(job_id: str, db: Session = Depends(get_db)):
    for job in REMEDIATION_JOBS_STORE:
        if job["id"] == job_id:
            job["status"] = "rolled_back"
            job["resultSummary"] = f"Action reverted successfully to previous state via MCP rollback token."
            job["executionTimeline"].append({
                "step": "Emergency Rollback",
                "agent": "MCP Rollback Orchestrator",
                "timestamp": "Just now",
                "status": "success",
                "detail": f"Reverted {job['actionName']} on {job['resourceId']} to prior configuration."
            })
            return {"success": True, "job": job}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remediation job not found.")
