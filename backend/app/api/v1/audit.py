from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/activity", tags=["Audit & Activity Logs"])

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def get_audit_logs():
    return [
        {
            "id": "audit_01",
            "timestamp": "2026-10-25 10:45:12 UTC",
            "actor": "kiran@cloudsense.ai",
            "actorRole": "admin",
            "action": "MODIFY_INSTANCE_TYPE",
            "resourceId": "i-08a9f24c7b8e1a3d",
            "environment": "production",
            "result": "success",
            "correlationId": "mcp-corr-98214",
            "details": "Downsized prod-analytics-worker-01 from c5.4xlarge to c5.2xlarge. Savings $482/mo."
        },
        {
            "id": "audit_02",
            "timestamp": "2026-10-25 09:20:05 UTC",
            "actor": "cloudsense-agent-autoscale",
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
            "actor": "system-cur-collector",
            "actorRole": "cloud_engineer",
            "action": "INGEST_AWS_CUR",
            "resourceId": "s3://cloudsense-billing-cur-exports-us-east-1/cur2.0/",
            "environment": "production",
            "result": "success",
            "correlationId": "mcp-corr-97840",
            "details": "Successfully ingested 42,500 daily line items from AWS Cost and Usage Reports."
        },
        {
            "id": "audit_04",
            "timestamp": "2026-10-24 14:02:19 UTC",
            "actor": "sarah.devops@cloudsense.ai",
            "actorRole": "cloud_engineer",
            "action": "APPROVE_POLICY_OVERRIDE",
            "resourceId": "asg-ml-data-pipeline",
            "environment": "staging",
            "result": "success",
            "correlationId": "mcp-corr-97621",
            "details": "Approved scale down of 12 idle worker nodes after ETL run completion."
        }
    ]
