import json
import logging
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..db.models import (
    AWSAccount,
    CloudResource,
    DailyCost,
    Recommendation,
    ApprovalRecord,
    AnomalyIncident,
    Notification,
    AuditEvent
)
from .collector import DOWNSIZE_TARGET_MAP
from .credentials import collector_for_account
from ..mcp.policies import generate_action_hash
from ..api.v1.integrations import dispatch_notification_to_webhooks

logger = logging.getLogger("cloudsense.aws.sync_pipeline")

def sync_live_aws_account(account: AWSAccount, db: Session) -> Dict[str, Any]:
    """Orchestrates real-time telemetry ingestion, resource inventory persistence,
    rule engine recommendation generation, and anomaly verification for an AWS account."""
    if account.is_demo:
        account.last_synced = datetime.datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "message": "CloudSense Demo Lab (Synthesis) active with continuous live ML inference.",
            "resources": account.resource_count,
            "monthly_spend": account.monthly_spend,
            "last_synced": account.last_synced.isoformat()
        }

    collector = collector_for_account(account)

    identity = collector.test_connection()
    if not identity.get("success"):
        account.status = "error"
        db.commit()
        return {
            "success": False,
            "message": identity.get("error") or "AWS authentication failed.",
            "resources": account.resource_count,
            "monthly_spend": account.monthly_spend,
        }

    if identity.get("account_id") and identity.get("account_id") != account.account_id:
        account.status = "error"
        db.commit()
        return {
            "success": False,
            "message": f"Credentials belong to AWS account {identity.get('account_id')}, not {account.account_id}.",
        }

    resources = collector.discover_resources()
    costs = collector.collect_cost_and_usage(days=30)

    # 1. Ingest Daily Cost History
    if costs:
        total_cost_usd = 0.0
        for c in costs:
            cost_val = float(c.get("amount", c.get("cost_usd", 0.0)))
            total_cost_usd += cost_val
            existing_dc = db.query(DailyCost).filter(
                DailyCost.account_id == account.account_id,
                DailyCost.date == c["date"],
                DailyCost.service == c["service"]
            ).first()
            if existing_dc:
                existing_dc.cost_usd = round(cost_val, 2)
            else:
                db.add(DailyCost(
                    account_id=account.account_id,
                    date=c["date"],
                    service=c["service"],
                    cost_usd=round(cost_val, 2)
                ))
        account.monthly_spend = round(total_cost_usd, 2)

    # 2. Ingest Discovered Resources
    recs_generated = 0
    if resources:
        for r in resources:
            res_id = r["id"]
            existing_res = db.query(CloudResource).filter(
                CloudResource.resource_id == res_id
            ).first()

            if existing_res:
                existing_res.account_id = account.account_id
                existing_res.name = r.get("name", res_id)
                existing_res.region = r.get("region", account.region or "us-east-1")
                existing_res.service = r.get("service", "EC2")
                existing_res.status = r.get("status", "running")
                existing_res.monthly_cost = float(r.get("monthlyCost", 0.0))
                existing_res.estimated_saving = float(r.get("estimatedSaving", 0.0))
                existing_res.risk_level = r.get("riskLevel", "low")
                existing_res.cpu_avg = float(r.get("cpuAvg", 0.0))
                existing_res.tags_json = json.dumps(r.get("tags", {}))
            else:
                new_res = CloudResource(
                    account_id=account.account_id,
                    resource_id=res_id,
                    resource_type=r.get("type", "ec2_instance"),
                    name=r.get("name", res_id),
                    region=r.get("region", account.region or "us-east-1"),
                    service=r.get("service", "EC2"),
                    status=r.get("status", "running"),
                    monthly_cost=float(r.get("monthlyCost", 0.0)),
                    estimated_saving=float(r.get("estimatedSaving", 0.0)),
                    risk_level=r.get("riskLevel", "low"),
                    cpu_avg=float(r.get("cpuAvg", 0.0)),
                    tags_json=json.dumps(r.get("tags", {})),
                    launch_time=datetime.datetime.utcnow()
                )
                db.add(new_res)

            # 3. Rule Engine: Generate Recommendations & Approvals for Idle / Oversized Resources
            status = r.get("status")
            res_type = r.get("type")
            res_name = r.get("name", res_id)
            monthly_cost = float(r.get("monthlyCost", 0.0))
            saving = float(r.get("estimatedSaving", 0.0))

            if status == "idle" and res_type == "ec2_instance":
                rec_id = f"rec_{account.account_id}_{res_id}_stop"
                title = f"Stop Idle EC2 Instance ({res_name})"
                desc = f"EC2 Instance {res_id} has shown near-zero CPU activity (average {r.get('cpuAvg', 0.5)}%) with no active workloads."
                payload = {"target_action": "stop_instance", "resource_id": res_id, "region": r.get("region", "us-east-1")}
                _upsert_recommendation_and_approval(
                    db=db,
                    account_id=account.account_id,
                    rec_id=rec_id,
                    title=title,
                    description=desc,
                    category="idle_resource",
                    service="EC2",
                    resource_id=res_id,
                    monthly_cost=monthly_cost,
                    savings=monthly_cost,
                    risk_level="low",
                    action_type="stop_instance",
                    payload=payload
                )
                recs_generated += 1

            elif status == "oversized" and res_type == "ec2_instance":
                inst_type = r.get("instanceType", "c5.4xlarge")
                target_type = DOWNSIZE_TARGET_MAP.get(inst_type, "c5.2xlarge")
                rec_id = f"rec_{account.account_id}_{res_id}_resize"
                title = f"Downsize Over-provisioned Instance {res_name} ({inst_type} -> {target_type})"
                desc = f"EC2 Instance {res_id} ({inst_type}) exhibits low compute headroom demand. Downsizing to {target_type} safely preserves SLA headroom."
                payload = {"target_action": "resize_instance", "resource_id": res_id, "target_instance_type": target_type, "region": r.get("region", "us-east-1")}
                _upsert_recommendation_and_approval(
                    db=db,
                    account_id=account.account_id,
                    rec_id=rec_id,
                    title=title,
                    description=desc,
                    category="rightsizing",
                    service="EC2",
                    resource_id=res_id,
                    monthly_cost=monthly_cost,
                    savings=saving or round(monthly_cost * 0.5, 2),
                    risk_level="low",
                    action_type="resize_instance",
                    payload=payload
                )
                recs_generated += 1

            elif status == "idle" and res_type == "ebs_volume":
                rec_id = f"rec_{account.account_id}_{res_id}_delete"
                title = f"Purge Unattached EBS Volume {res_name} ({r.get('sizeGb', 100)} GB)"
                desc = f"EBS Volume {res_id} has been detached from all host instances, generating unallocated storage costs."
                payload = {"target_action": "delete_volume", "resource_id": res_id, "size_gb": r.get("sizeGb", 100), "region": r.get("region", "us-east-1")}
                _upsert_recommendation_and_approval(
                    db=db,
                    account_id=account.account_id,
                    rec_id=rec_id,
                    title=title,
                    description=desc,
                    category="ebs_cleanup",
                    service="EBS",
                    resource_id=res_id,
                    monthly_cost=monthly_cost,
                    savings=monthly_cost,
                    risk_level="low",
                    action_type="delete_volume",
                    payload=payload
                )
                recs_generated += 1

            elif status == "oversized" and r.get("volumeType") == "gp2":
                rec_id = f"rec_{account.account_id}_{res_id}_gp3"
                title = f"Convert EBS Volume {res_name} from gp2 to gp3"
                desc = f"Migrating {res_id} to gp3 provides an immediate 20% storage cost reduction while enhancing baseline baseline throughput to 125 MB/s."
                payload = {"target_action": "convert_gp2_to_gp3", "resource_id": res_id, "region": r.get("region", "us-east-1")}
                _upsert_recommendation_and_approval(
                    db=db,
                    account_id=account.account_id,
                    rec_id=rec_id,
                    title=title,
                    description=desc,
                    category="rightsizing",
                    service="EBS",
                    resource_id=res_id,
                    monthly_cost=monthly_cost,
                    savings=saving or round(monthly_cost * 0.20, 2),
                    risk_level="low",
                    action_type="convert_gp2_to_gp3",
                    payload=payload
                )
                recs_generated += 1

        account.resource_count = len(resources)
        if not costs:
            account.monthly_spend = round(sum(float(r.get("monthlyCost", 0.0)) for r in resources), 2)

    account.status = "connected"
    account.last_synced = datetime.datetime.utcnow()
    db.commit()

    # Outbound webhook notification if recommendations were identified
    if recs_generated > 0:
        db.add(Notification(
            title=f"{recs_generated} FinOps Optimization Proposals Ready",
            message=f"Sync completed for account {account.account_id}. Discovered {recs_generated} rightsizing/idle reduction opportunities.",
            severity="high",
            category="approval",
            read=False,
            created_at=datetime.datetime.utcnow(),
            link="/approvals"
        ))
        db.add(AuditEvent(
            event_id=f"evt_sync_{account.account_id}_{int(datetime.datetime.utcnow().timestamp())}",
            actor="Boto3 Sync Pipeline",
            action="DISCOVERY_PROPOSALS_GENERATED",
            target=account.account_id,
            target_type="AWS_ACCOUNT",
            status="SUCCESS",
            details_json=json.dumps({"recs_generated": recs_generated, "resource_count": account.resource_count})
        ))
        db.commit()

        dispatch_notification_to_webhooks(
            event_type="approval",
            title=f"CloudSense Discovered {recs_generated} FinOps Optimization Opportunities",
            description=f"Automated Boto3 sync completed for AWS Account {account.account_id}. {recs_generated} actionable rightsizing proposals generated and queued for human approval.",
            data={"account_id": account.account_id, "opportunities": recs_generated}
        )

    return {
        "success": True,
        "message": f"Successfully synchronized {len(resources)} AWS resources and latest billing telemetry.",
        "resources": account.resource_count,
        "monthly_spend": account.monthly_spend,
        "recommendations_generated": recs_generated,
        "last_synced": account.last_synced.isoformat()
    }

def _upsert_recommendation_and_approval(
    db: Session,
    account_id: str,
    rec_id: str,
    title: str,
    description: str,
    category: str,
    service: str,
    resource_id: str,
    monthly_cost: float,
    savings: float,
    risk_level: str,
    action_type: str,
    payload: Dict[str, Any]
):
    """Helper to upsert a recommendation and ensure a corresponding approval item is pending."""
    rec = db.query(Recommendation).filter(Recommendation.rec_id == rec_id).first()
    if rec:
        rec.account_id = account_id
        rec.title = title
        rec.description = description
        rec.current_monthly_cost = monthly_cost
        rec.estimated_savings_monthly = savings
        rec.action_payload_json = json.dumps(payload)
    else:
        rec = Recommendation(
            account_id=account_id,
            rec_id=rec_id,
            title=title,
            description=description,
            category=category,
            service=service,
            resource_id=resource_id,
            current_monthly_cost=monthly_cost,
            estimated_savings_monthly=savings,
            risk_level=risk_level,
            action_type=action_type,
            action_payload_json=json.dumps(payload),
            status="pending_approval"
        )
        db.add(rec)

    # Check approval record
    action_hash = generate_action_hash(action_type, resource_id, payload)
    appr = db.query(ApprovalRecord).filter(
        ApprovalRecord.recommendation_id == rec_id
    ).first()
    if not appr:
        new_appr = ApprovalRecord(
            account_id=account_id,
            recommendation_id=rec_id,
            approver_id="pending",
            approver_name="FinOps Governance",
            decision="pending",
            decision_notes="Automated recommendation generated from live Boto3 inventory telemetry.",
            action_hash=action_hash,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
        )
        db.add(new_appr)
