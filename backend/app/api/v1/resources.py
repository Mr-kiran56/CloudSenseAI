from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db

router = APIRouter(prefix="/resources", tags=["Cloud Resources"])

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_resources(
    service: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Return cloud inventory resources with live telemetry metrics."""
    resources = [
        {
            "id": "res_ec2_01",
            "resourceId": "i-08a9f24c7b8e1a3d",
            "name": "prod-analytics-worker-01",
            "service": "EC2",
            "region": "us-east-1",
            "environment": "production",
            "status": "oversized",
            "cpuUtilization": 14.2,
            "memoryUtilization": 28.5,
            "networkIOMbs": 85.4,
            "monthlyCost": 768.00,
            "estimatedSaving": 482.00,
            "riskLevel": "low",
            "lastSeen": "Just now",
            "tags": {"Environment": "Production", "Owner": "DataPlatform", "Workload": "ETL"},
            "metricsHistory": [
                {"timestamp": "08:00", "cpu": 12.1, "memory": 27.0, "cost": 1.05},
                {"timestamp": "10:00", "cpu": 15.4, "memory": 29.2, "cost": 1.05},
                {"timestamp": "12:00", "cpu": 18.2, "memory": 31.0, "cost": 1.05},
                {"timestamp": "14:00", "cpu": 14.0, "memory": 28.0, "cost": 1.05}
            ]
        },
        {
            "id": "res_ec2_02",
            "resourceId": "i-09f182c448bb92aa",
            "name": "dev-sandbox-ml-train",
            "service": "EC2",
            "region": "us-west-2",
            "environment": "dev",
            "status": "idle",
            "cpuUtilization": 0.8,
            "memoryUtilization": 4.1,
            "networkIOMbs": 0.2,
            "monthlyCost": 412.00,
            "estimatedSaving": 412.00,
            "riskLevel": "low",
            "lastSeen": "5m ago",
            "tags": {"Environment": "Development", "Team": "MLResearch", "AutoStop": "false"},
            "metricsHistory": [
                {"timestamp": "08:00", "cpu": 0.5, "memory": 4.0, "cost": 0.56},
                {"timestamp": "10:00", "cpu": 0.8, "memory": 4.1, "cost": 0.56},
                {"timestamp": "12:00", "cpu": 1.1, "memory": 4.2, "cost": 0.56},
                {"timestamp": "14:00", "cpu": 0.7, "memory": 4.0, "cost": 0.56}
            ]
        },
        {
            "id": "res_ebs_01",
            "resourceId": "vol-0e78291f09bb2a4c1",
            "name": "unattached-db-backup-gp3",
            "service": "EBS",
            "region": "us-east-1",
            "environment": "production",
            "status": "idle",
            "cpuUtilization": 0.0,
            "memoryUtilization": 0.0,
            "networkIOMbs": 0.0,
            "monthlyCost": 185.00,
            "estimatedSaving": 185.00,
            "riskLevel": "low",
            "lastSeen": "Detached 24 days ago",
            "tags": {"SnapshotBackup": "snap-0489aa21b", "Lifecycle": "Orphaned"},
            "metricsHistory": [
                {"timestamp": "08:00", "cpu": 0.0, "memory": 0.0, "cost": 0.25},
                {"timestamp": "10:00", "cpu": 0.0, "memory": 0.0, "cost": 0.25},
                {"timestamp": "12:00", "cpu": 0.0, "memory": 0.0, "cost": 0.25},
                {"timestamp": "14:00", "cpu": 0.0, "memory": 0.0, "cost": 0.25}
            ]
        },
        {
            "id": "res_rds_01",
            "resourceId": "rds-aurora-cluster-prod",
            "name": "aurora-pg-orders-master",
            "service": "RDS",
            "region": "us-east-1",
            "environment": "production",
            "status": "healthy",
            "cpuUtilization": 48.6,
            "memoryUtilization": 64.2,
            "networkIOMbs": 310.0,
            "monthlyCost": 1840.00,
            "estimatedSaving": 0.00,
            "riskLevel": "medium",
            "lastSeen": "Just now",
            "tags": {"Environment": "Production", "Engine": "Aurora-PostgreSQL", "Tier": "Database"},
            "metricsHistory": [
                {"timestamp": "08:00", "cpu": 42.0, "memory": 62.0, "cost": 2.52},
                {"timestamp": "10:00", "cpu": 51.0, "memory": 65.0, "cost": 2.52},
                {"timestamp": "12:00", "cpu": 49.5, "memory": 64.0, "cost": 2.52},
                {"timestamp": "14:00", "cpu": 48.6, "memory": 64.2, "cost": 2.52}
            ]
        },
        {
            "id": "res_lambda_01",
            "resourceId": "arn:aws:lambda:us-east-1:123456789012:function:checkout-payment-handler",
            "name": "checkout-payment-handler",
            "service": "Lambda",
            "region": "us-east-1",
            "environment": "production",
            "status": "critical",
            "cpuUtilization": 88.4,
            "memoryUtilization": 82.0,
            "networkIOMbs": 420.0,
            "monthlyCost": 640.00,
            "estimatedSaving": 380.00,
            "riskLevel": "critical",
            "lastSeen": "DoW Wave Detected",
            "tags": {"Environment": "Production", "Service": "PaymentGateway", "Runtime": "nodejs20.x"},
            "metricsHistory": [
                {"timestamp": "14:00", "cpu": 25.0, "memory": 35.0, "cost": 0.20},
                {"timestamp": "14:10", "cpu": 72.0, "memory": 68.0, "cost": 0.85},
                {"timestamp": "14:15", "cpu": 88.4, "memory": 82.0, "cost": 1.40},
                {"timestamp": "14:20", "cpu": 86.0, "memory": 80.0, "cost": 1.35}
            ]
        }
    ]

    # Filters
    if service:
        resources = [r for r in resources if r["service"].lower() == service.lower()]
    if status:
        resources = [r for r in resources if r["status"].lower() == status.lower()]
    if region:
        resources = [r for r in resources if r["region"].lower() == region.lower()]

    return resources
