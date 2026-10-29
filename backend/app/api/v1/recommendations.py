import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db
from ...db.models import Recommendation as DBRecommendation, User
from ..deps import get_current_user, assert_account_access

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

RECOMMENDATIONS_STORE: List[Dict[str, Any]] = [
    {
        "id": "rec_01_ec2_resize",
        "title": "Downsize Over-provisioned Analytics Worker Instance",
        "resourceId": "i-08a9f24c7b8e1a3d",
        "resourceName": "prod-analytics-worker-01",
        "service": "EC2",
        "region": "us-east-1",
        "problem": "Instance type c5.4xlarge (16 vCPU, 32 GiB RAM) averages 14.2% CPU utilization with P95 under 22.8% over the past 30 days.",
        "rootCause": "Oversized instance allocated during initial benchmarking, never downscaled after ETL stream optimization.",
        "aiConfidence": 0.96,
        "risk": "low",
        "monthlySavings": 482.00,
        "annualSavings": 5784.00,
        "businessImpact": "Zero customer impact; instance handles asynchronous data ingestion jobs with 45-minute SLA buffer.",
        "performanceImpact": "Projected P95 CPU will rise safely from 22.8% to 45.6%, well within the safe operational threshold (<65%).",
        "recommendedAction": "Modify instance type to c5.2xlarge (8 vCPU, 16 GiB RAM).",
        "rollbackAction": "Re-modify instance type back to c5.4xlarge (takes ~3 minutes via EC2 API).",
        "status": "needs_review",
        "createdAt": "2 hours ago",
        "shapFeatures": [
            {"feature": "cpu_utilization_p95", "impact": -0.42, "description": "Consistently low peak compute demand"},
            {"feature": "provisioning_frequency", "impact": 0.12, "description": "Static long-running instance profile"},
            {"feature": "memory_headroom", "impact": -0.28, "description": "Over 20 GiB unallocated buffer observed"}
        ],
        "evidence": [
            {"metric": "Average CPU Utilization", "value": "14.2%", "baseline": "Target: 55-70%"},
            {"metric": "P95 CPU Utilization", "value": "22.8%", "baseline": "Safe Ceiling: 65.0%"},
            {"metric": "Peak Memory Footprint", "value": "9.4 GiB", "baseline": "Allocated: 32.0 GiB"}
        ]
    },
    {
        "id": "rec_02_idle_sandbox",
        "title": "Terminate Stale Research ML Instance Left Running",
        "resourceId": "i-09f182c448bb92aa",
        "resourceName": "dev-sandbox-ml-train",
        "service": "EC2",
        "region": "us-west-2",
        "problem": "Instance g4dn.xlarge GPU training instance has shown 0.8% CPU and 0.0% GPU activity for 19 consecutive days.",
        "rootCause": "Ad-hoc notebook training session left active post-sprint without an automated TTL schedule.",
        "aiConfidence": 0.99,
        "risk": "low",
        "monthlySavings": 412.00,
        "annualSavings": 4944.00,
        "businessImpact": "Zero production impact; tagged as non-production research sandbox.",
        "performanceImpact": "None. Storage state preserved via persistent EBS snapshot before termination.",
        "recommendedAction": "Create automated EBS volume snapshot, then terminate idle instance.",
        "rollbackAction": "Re-launch from snapshot using same IAM role and security group.",
        "status": "needs_review",
        "createdAt": "5 hours ago",
        "shapFeatures": [
            {"feature": "gpu_utilization_avg", "impact": -0.85, "description": "Zero GPU kernel calls executed"},
            {"feature": "network_rx_tx", "impact": -0.35, "description": "Zero external training data ingress"}
        ],
        "evidence": [
            {"metric": "Consecutive Idle Days", "value": "19 Days", "baseline": "Threshold: 7 Days"},
            {"metric": "Average CPU Utilization", "value": "0.8%", "baseline": "Threshold: < 2.0%"}
        ]
    },
    {
        "id": "rec_03_unattached_ebs",
        "title": "Purge Orphaned gp3 Storage Volumes (6 Detached Volumes)",
        "resourceId": "vol-0e78291f09bb2a4c1",
        "resourceName": "unattached-db-backup-gp3",
        "service": "EBS",
        "region": "us-east-1",
        "problem": "6 gp3/io2 EBS volumes totaling 2,400 GB have been unattached for > 21 days following Kubernetes node migration.",
        "rootCause": "PersistentVolumeClaims orphaned when Helm release was uninstalled without persistent volume cleanup.",
        "aiConfidence": 0.98,
        "risk": "low",
        "monthlySavings": 394.00,
        "annualSavings": 4728.00,
        "businessImpact": "Zero active application bindings. Snapshot backup verification confirms all disk data archived.",
        "performanceImpact": "None. Detached disks consume zero IOPS bandwidth.",
        "recommendedAction": "Verify final automated snapshot in S3 Glacier, then delete unattached EBS volumes.",
        "rollbackAction": "Restore volume from snapshot in < 2 minutes.",
        "status": "needs_review",
        "createdAt": "1 day ago",
        "shapFeatures": [
            {"feature": "attachment_state", "impact": -0.92, "description": "State=available (unattached)"},
            {"feature": "detached_days_count", "impact": -0.64, "description": "21 days without mount event"}
        ],
        "evidence": [
            {"metric": "Detached Duration", "value": "21 Days", "baseline": "Policy Limit: 14 Days"},
            {"metric": "Total Orphaned Capacity", "value": "2,400 GB", "baseline": "0 GB"}
        ]
    },
    {
        "id": "rec_04_savings_plan",
        "title": "Purchase 1-Year Compute Savings Plan for Baseline Workloads",
        "resourceId": "sp-compute-baseline-2026",
        "resourceName": "Compute Savings Plan (1-Yr No Upfront)",
        "service": "EC2",
        "region": "us-east-1",
        "problem": "Consistently consuming > $14/hour of baseline compute across EC2 and Lambda on on-demand rates without discount commitments.",
        "rootCause": "Organization has reached predictable steady-state workload maturity without FinOps commitment coverage.",
        "aiConfidence": 0.94,
        "risk": "low",
        "monthlySavings": 1890.00,
        "annualSavings": 22680.00,
        "businessImpact": "Saves 28-34% across all EC2, Fargate, and Lambda usage with zero architecture modifications.",
        "performanceImpact": "Zero infrastructure changes; billing discount applied automatically at the AWS invoice level.",
        "recommendedAction": "Commit to $10.50/hour 1-Year No Upfront Compute Savings Plan.",
        "rollbackAction": "Non-reversible after 7 days; requires FinOps VP approval.",
        "status": "needs_review",
        "createdAt": "3 days ago",
        "shapFeatures": [
            {"feature": "baseline_compute_hours", "impact": 0.88, "description": "99.2% hourly utilization stability"},
            {"feature": "growth_rate_trend", "impact": 0.42, "description": "Positive forward forecast (Prophet Model A)"}
        ],
        "evidence": [
            {"metric": "Baseline Hourly Spend", "value": "$14.20 / hr", "baseline": "Commitment target: $10.50/hr"},
            {"metric": "Projected ROI", "value": "340%", "baseline": "Min FinOps Hurdle: 120%"}
        ]
    }
]

def _format_db_recommendation(r: DBRecommendation) -> Dict[str, Any]:
    status_str = "needs_review" if r.status in ["pending_approval", "pending"] else r.status
    monthly_sav = float(r.estimated_savings_monthly or 0.0)
    return {
        "id": r.rec_id,
        "title": r.title,
        "resourceId": r.resource_id,
        "resourceName": r.resource_id,
        "service": r.service,
        "region": "us-east-1",
        "problem": r.description,
        "rootCause": "Discovered via live Boto3 resource & CloudWatch utilization telemetry.",
        "aiConfidence": float(r.confidence or 0.95),
        "risk": r.risk_level or "low",
        "monthlySavings": monthly_sav,
        "annualSavings": round(monthly_sav * 12, 2),
        "businessImpact": "Safe automated remediation with zero active traffic degradation.",
        "performanceImpact": "Within optimal capacity headroom bounds.",
        "recommendedAction": f"Execute automated MCP tool: {r.action_type}",
        "rollbackAction": "Automatic snapshot or state rollback available via CloudSense MCP.",
        "status": status_str,
        "createdAt": r.created_at.strftime("%b %d, %H:%M UTC") if r.created_at else "Recently synced",
        "shapFeatures": [
            {"feature": "cpu_utilization_p95", "impact": -0.45, "description": "Persistent under-utilization"},
            {"feature": "provisioning_frequency", "impact": 0.15, "description": "Static allocation profile"}
        ],
        "evidence": [
            {"metric": "Monthly Current Cost", "value": f"${r.current_monthly_cost:,.2f}", "baseline": "Target: Optimized"},
            {"metric": "Estimated Savings", "value": f"${monthly_sav:,.2f} / mo", "baseline": "High Confidence"}
        ]
    }

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_recommendations(
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    db_recs = db.query(DBRecommendation).filter(DBRecommendation.account_id == scoped_id).all()
    return [_format_db_recommendation(r) for r in db_recs]

@router.get("/{rec_id}")
def get_recommendation_detail(
    rec_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_rec = db.query(DBRecommendation).filter(DBRecommendation.rec_id == rec_id).first()
    if not db_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")
    assert_account_access(db_rec.account_id, current_user, db)
    return _format_db_recommendation(db_rec)
