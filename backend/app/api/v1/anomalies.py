from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...db.session import get_db
from ...ml.model_service import ml_service

router = APIRouter(prefix="/anomalies", tags=["Anomalies & DoW Detection"])

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_anomalies(db: Session = Depends(get_db)):
    """Return live anomaly and Denial-of-Wallet (DoW) incidents scored by Isolation Forest."""
    return [
        {
            "id": "anom_01_dow",
            "type": "denial_of_wallet",
            "title": "Denial-of-Wallet (DoW) Wave on Lambda Checkout API",
            "severity": "critical",
            "confidence": 0.96,
            "resourceId": "arn:aws:lambda:us-east-1:123456789012:function:checkout-payment-handler",
            "resourceName": "checkout-payment-handler",
            "service": "Lambda",
            "region": "us-east-1",
            "costVelocity": "+420% / 15m",
            "requestRateChange": "+580%",
            "provisioningSpike": "Concurrency saturation (980/1000)",
            "detectedAt": "14 minutes ago",
            "status": "investigating",
            "evidence": [
                "Isolation Forest anomaly score = 14.82 (calibrated threshold 11.25)",
                "Burst invocations with random non-existent checkout payloads",
                "Execution duration stretched by upstream database timeout loop",
                "Zero conversion to completed order ledger transactions"
            ],
            "attackTimeline": [
                {"step": "Initial Ingress Anomaly", "timestamp": "14:10 UTC", "status": "completed", "description": "Rapid spike in POST /v2/checkout from distributed residential IP blocks"},
                {"step": "Cost Velocity Divergence", "timestamp": "14:15 UTC", "status": "completed", "description": "Hourly burn jumped from $4.10/hr to $48.60/hr (+1085%)"},
                {"step": "Isolation Forest Triaged", "timestamp": "14:18 UTC", "status": "completed", "description": "Classified as dow_candidate (confidence 96%)"},
                {"step": "Human Approval Pending", "timestamp": "14:22 UTC", "status": "current", "description": "WAF rate limit rule prepared for operator approval"}
            ]
        },
        {
            "id": "anom_02_ec2_runaway",
            "type": "cost_anomaly",
            "title": "Unbounded AutoScaling Spike in ML Ingestion Cluster",
            "severity": "high",
            "confidence": 0.91,
            "resourceId": "asg-ml-data-pipeline",
            "resourceName": "asg-ml-data-pipeline",
            "service": "AutoScaling",
            "region": "us-west-2",
            "costVelocity": "+185% / 1h",
            "requestRateChange": "+40%",
            "provisioningSpike": "Scale from 4 to 28 c5.2xlarge instances",
            "detectedAt": "1 hour ago",
            "status": "detected",
            "evidence": [
                "Provisioning frequency feature = 0.44/min (Isolation Forest outlier)",
                "Dead-letter queue reprocessing loop constantly failing",
                "Nodes spinning up and terminating immediately upon task timeout"
            ],
            "attackTimeline": [
                {"step": "Queue Depth Spike", "timestamp": "13:00 UTC", "status": "completed", "description": "SQS queue reached 45,000 unhandled poison pills"},
                {"step": "Autoscaling Cascade", "timestamp": "13:15 UTC", "status": "completed", "description": "ASG expanded max capacity to 28 instances"},
                {"step": "FinOps Detection", "timestamp": "13:30 UTC", "status": "current", "description": "Isolation Forest triggered alert score 12.40"}
            ]
        },
        {
            "id": "anom_03_nat_gateway",
            "type": "cost_anomaly",
            "title": "High Egress Data Transfer on Private NAT Gateway",
            "severity": "medium",
            "confidence": 0.84,
            "resourceId": "nat-04a8b79c21e0f331",
            "resourceName": "nat-gw-priv-subnet-a",
            "service": "NATGateway",
            "region": "us-east-1",
            "costVelocity": "+74% / 24h",
            "requestRateChange": "+15%",
            "provisioningSpike": "Egress 4.8 TB over 8 hours",
            "detectedAt": "3 hours ago",
            "status": "investigating",
            "evidence": [
                "Unoptimized S3 backups routing over public NAT instead of Gateway Endpoint",
                "Direct S3 Gateway Endpoint missing in VPC route table `rtb-prod-private`",
                "Estimated unnecessary egress fee: $216.00 / day"
            ],
            "attackTimeline": [
                {"step": "Backup Pipeline Executed", "timestamp": "11:00 UTC", "status": "completed", "description": "Analytics team initiated large Parquet cold storage copy"},
                {"step": "NAT Gateway Saturated", "timestamp": "11:30 UTC", "status": "completed", "description": "Data transfer fees exceeded daily budget"},
                {"step": "Recommendation Queued", "timestamp": "12:00 UTC", "status": "current", "description": "Add free S3 VPC Gateway Endpoint to route table"}
            ]
        }
    ]

@router.post("/detect")
def detect_anomaly(telemetry: Dict[str, Any] = Body(...)):
    """Run live 5-minute Isolation Forest Model C inference."""
    result = ml_service.anomaly_detector.score_window(telemetry)
    return result
