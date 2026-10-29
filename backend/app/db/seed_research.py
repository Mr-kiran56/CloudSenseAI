import csv
import json
import uuid
import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import get_password_hash
from ..core.secrets import encrypt_secret
from ..mcp.policies import generate_action_hash
from .models import (
    AWSAccount,
    AnomalyIncident,
    DailyCost,
    ModelRegistryRecord,
    User,
    CloudResource,
    Recommendation,
    ApprovalRecord,
    Notification,
    AuditEvent,
)

DATA_DIR = (
    settings.BASE_DIR.parent
    / "ML_ModelDATA"
    / "CloudSenseNEWML"
    / "cloudsense_ml"
    / "cloudsense_ml"
    / "data"
)
INCIDENTS_CSV = (
    settings.ARTIFACTS_DIR / "outputs_model_c" / "artifacts" / "incidents_detected.csv"
)


def seed_research_lab(db: Session) -> None:
    # 1. Admin Users
    admin = db.query(User).filter(User.email == "admin@cloudsense.ai").first()
    if not admin:
        admin = User(
            email="admin@cloudsense.ai",
            hashed_password=get_password_hash("Admin@123456"),
            full_name="CloudSense Research Admin",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # Kiran User from CREDCS.txt
    kiran_user = db.query(User).filter(User.email == "kiranpunna58@gmail.com").first()
    if not kiran_user:
        kiran_user = User(
            email="kiranpunna58@gmail.com",
            hashed_password=get_password_hash("KIRAN5656@"),
            full_name="Kiran Punna",
            role="admin",
            is_active=True,
        )
        db.add(kiran_user)
        db.commit()
        db.refresh(kiran_user)

    # 2. AWS Accounts: Demo Lab & Real Account
    demo = db.query(AWSAccount).filter(AWSAccount.account_id == "synthesis-demo").first()
    if not demo:
        demo = AWSAccount(
            account_id="synthesis-demo",
            name="CloudSense Research Lab",
            alias="demo-synthesis-lab",
            env="demo",
            region="us-east-1",
            role_arn=None,
            status="connected",
            monthly_spend=0.0,
            resource_count=0,
            is_demo=True,
            last_synced=datetime.datetime.utcnow(),
        )
        db.add(demo)
        db.commit()

    # Seed real AWS account 658606186069 for Kiran
    _seed_real_kiran_account(db, kiran_user)

    # 3. Model Registry Records
    if db.query(ModelRegistryRecord).count() == 0:
        db.add_all(
            [
                ModelRegistryRecord(
                    model_name="prophet_cost",
                    version="1.0.0",
                    variant="P3_tuned",
                    metrics_json='{"cv_mape_30d": 0.087, "holdout_mape_30d": 0.048}',
                    parameters_json='{"growth": "linear", "interval_width": 0.80}',
                    artifact_path="outputs_model_a/artifacts/model_registry/prophet_cost",
                    active=True,
                ),
                ModelRegistryRecord(
                    model_name="xgb_unit_economics",
                    version="1.0.0",
                    variant="xgb_final_refit",
                    metrics_json='{"test_r2": 0.994, "test_mape": 0.046}',
                    parameters_json='{"n_estimators": 500, "max_depth": 6}',
                    artifact_path="outputs_model_b/artifacts/model_registry/xgb_unit_economics",
                    active=True,
                ),
                ModelRegistryRecord(
                    model_name="isoforest_anomaly",
                    version="1.0.0",
                    variant="HYBRID_IF_zrule",
                    metrics_json='{"any_anomaly_auprc": 0.83}',
                    parameters_json='{"threshold": 11.2454}',
                    artifact_path="outputs_model_c/artifacts/model_registry/isoforest_extended",
                    active=True,
                ),
            ]
        )
        db.commit()

    # 4. Ingest Cost History & Incidents & Benchmark Resources
    _load_cost_history(db)
    _load_model_c_incidents(db)
    _seed_demo_resources_and_recommendations(db)


def _seed_real_kiran_account(db: Session, kiran_user: User) -> None:
    acc = db.query(AWSAccount).filter(AWSAccount.account_id == "658606186069").first()
    
    # Read access keys from file if available and encrypt them
    ak = None
    sk = None
    keys_file = settings.BASE_DIR.parent / "KIRAN_accessKeys (1).csv"
    if keys_file.exists():
        try:
            with keys_file.open("r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                row = next(reader, None)
                if row:
                    ak = row.get("Access key ID", "").strip()
                    sk = row.get("Secret access key", "").strip()
        except Exception:
            pass

    if not acc:
        acc = AWSAccount(
            user_id=kiran_user.id,
            user_email=kiran_user.email,
            account_id="658606186069",
            name="Kiran AWS Account (Production)",
            alias="kiran-prod-aws",
            env="production",
            region="us-east-1",
            role_arn="arn:aws:iam::658606186069:role/CloudSenseFinOpsReadOnlyPolicy",
            access_key_id=encrypt_secret(ak) if ak else None,
            secret_access_key=encrypt_secret(sk) if sk else None,
            external_id="cloudsense-audit-token",
            status="connected",
            monthly_spend=0.0,
            resource_count=0,
            is_demo=False,
            last_synced=datetime.datetime.utcnow(),
        )
        db.add(acc)
        db.commit()
    else:
        # Update credentials and ownership if missing
        if not acc.user_id:
            acc.user_id = kiran_user.id
            acc.user_email = kiran_user.email
        if ak and not acc.access_key_id:
            acc.access_key_id = encrypt_secret(ak)
            acc.secret_access_key = encrypt_secret(sk)
        if not acc.role_arn:
            acc.role_arn = "arn:aws:iam::658606186069:role/CloudSenseFinOpsReadOnlyPolicy"
            acc.external_id = "cloudsense-audit-token"
        db.commit()


def _load_cost_history(db: Session) -> None:
    existing = db.query(DailyCost).filter(DailyCost.account_id == "synthesis-demo").count()
    if existing > 0:
        _refresh_demo_spend(db)
        return

    cost_file = DATA_DIR / "A_cost_by_service_daily.csv"
    if not cost_file.exists():
        return

    cutoff = (datetime.date.today() - datetime.timedelta(days=120)).isoformat()
    batch = []
    with cost_file.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            ds = row.get("ds") or row.get("date")
            if not ds or ds < cutoff:
                continue
            batch.append(
                DailyCost(
                    account_id="synthesis-demo",
                    date=ds,
                    service=row.get("service") or "Unknown",
                    cost_usd=float(row.get("y") or row.get("cost_usd") or 0.0),
                )
            )
            if len(batch) >= 500:
                db.add_all(batch)
                db.commit()
                batch = []
    if batch:
        db.add_all(batch)
        db.commit()
    _refresh_demo_spend(db)


def _refresh_demo_spend(db: Session) -> None:
    demo = db.query(AWSAccount).filter(AWSAccount.account_id == "synthesis-demo").first()
    if not demo:
        return
    rows = db.query(DailyCost).filter(DailyCost.account_id == "synthesis-demo").all()
    if not rows:
        return
    latest = max(r.date for r in rows)
    start = (datetime.date.fromisoformat(latest) - datetime.timedelta(days=29)).isoformat()
    month_total = sum(float(r.cost_usd or 0.0) for r in rows if r.date >= start)
    demo.monthly_spend = round(month_total, 2)
    demo.last_synced = datetime.datetime.utcnow()
    db.commit()


def _load_model_c_incidents(db: Session) -> None:
    if db.query(AnomalyIncident).count() > 0 or not INCIDENTS_CSV.exists():
        return
    with INCIDENTS_CSV.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            incident_id = row.get("incident_id")
            if not incident_id:
                continue
            if db.query(AnomalyIncident).filter(AnomalyIncident.incident_id == incident_id).first():
                continue
            score = float(row.get("peak_score") or 0.0)
            triage = row.get("triage") or row.get("true_class") or "operational_anomaly"
            severity = (row.get("severity") or "medium").lower()
            title = f"Model C alert {incident_id}: {triage.replace('_', ' ')}"
            detected = None
            start = row.get("start")
            if start:
                try:
                    detected = datetime.datetime.fromisoformat(start.replace("Z", ""))
                except ValueError:
                    detected = datetime.datetime.utcnow()
            db.add(
                AnomalyIncident(
                    incident_id=incident_id,
                    title=title,
                    service="CloudWatch",
                    resource_id=f"research-lab:{incident_id}",
                    score=score,
                    threshold=11.2454,
                    severity=severity if severity in {"low", "medium", "high", "critical"} else "medium",
                    status="open",
                    triage_class="dow_candidate" if "dow" in triage else "operational_anomaly",
                    root_cause=row.get("reasons") or "Scored from Isolation Forest evaluation artifacts.",
                    detected_at=detected or datetime.datetime.utcnow(),
                    evidence_json="{}",
                )
            )
        db.commit()


def _seed_demo_resources_and_recommendations(db: Session) -> None:
    """Populate research lab cloud resources and recommendations from project specification."""
    sample_resources = [
        {
            "resource_id": "i-08a9f24c7b8e1a3d",
            "type": "ec2_instance",
            "name": "prod-analytics-worker-01",
            "region": "us-east-1",
            "service": "EC2",
            "status": "oversized",
            "monthly_cost": 496.40,
            "estimated_saving": 248.20,
            "risk_level": "low",
            "cpu_avg": 14.2,
            "tags": {"Environment": "production", "Team": "DataPlatform", "Workload": "ETL"}
        },
        {
            "resource_id": "i-09f182c448bb92aa",
            "type": "ec2_instance",
            "name": "dev-sandbox-ml-train",
            "region": "us-east-1",
            "service": "EC2",
            "status": "idle",
            "monthly_cost": 384.00,
            "estimated_saving": 384.00,
            "risk_level": "low",
            "cpu_avg": 0.8,
            "tags": {"Environment": "dev", "Team": "Research", "IdleDays": "19"}
        },
        {
            "resource_id": "i-03b174e92a8c5f6d",
            "type": "ec2_instance",
            "name": "api-payment-gateway-fleet",
            "region": "us-east-1",
            "service": "EC2",
            "status": "running",
            "monthly_cost": 242.94,
            "estimated_saving": 0.0,
            "risk_level": "low",
            "cpu_avg": 54.0,
            "tags": {"Environment": "production", "Team": "CoreBanking"}
        },
        {
            "resource_id": "i-01c9a4d87e2b3f11",
            "type": "ec2_instance",
            "name": "etl-stream-processor",
            "region": "us-east-1",
            "service": "EC2",
            "status": "oversized",
            "monthly_cost": 280.32,
            "estimated_saving": 140.16,
            "risk_level": "low",
            "cpu_avg": 18.5,
            "tags": {"Environment": "production", "Team": "DataPlatform"}
        },
        {
            "resource_id": "vol-0e78291f09bb2a4c1",
            "type": "ebs_volume",
            "name": "unattached-db-backup-gp3",
            "region": "us-east-1",
            "service": "EBS",
            "status": "idle",
            "monthly_cost": 192.00,
            "estimated_saving": 192.00,
            "risk_level": "low",
            "cpu_avg": 0.0,
            "tags": {"Environment": "production", "SizeGB": "2400"}
        },
        {
            "resource_id": "vol-0a12b34c56de78f90",
            "type": "ebs_volume",
            "name": "legacy-app-data-gp2",
            "region": "us-east-1",
            "service": "EBS",
            "status": "oversized",
            "monthly_cost": 50.00,
            "estimated_saving": 10.00,
            "risk_level": "low",
            "cpu_avg": 0.0,
            "tags": {"Environment": "production", "VolumeType": "gp2"}
        },
        {
            "resource_id": "rds-prod-primary-aurora",
            "type": "rds_instance",
            "name": "rds-prod-primary-aurora",
            "region": "us-east-1",
            "service": "RDS",
            "status": "healthy",
            "monthly_cost": 380.00,
            "estimated_saving": 0.0,
            "risk_level": "low",
            "cpu_avg": 42.0,
            "tags": {"Environment": "production", "Engine": "aurora-postgresql"}
        },
        {
            "resource_id": "checkout-payment-handler",
            "type": "lambda_function",
            "name": "checkout-payment-handler",
            "region": "us-east-1",
            "service": "Lambda",
            "status": "healthy",
            "monthly_cost": 45.00,
            "estimated_saving": 0.0,
            "risk_level": "low",
            "cpu_avg": 0.0,
            "tags": {"Environment": "production", "Runtime": "nodejs20.x"}
        }
    ]

    for res in sample_resources:
        existing_res = db.query(CloudResource).filter(
            CloudResource.account_id == "synthesis-demo",
            CloudResource.resource_id == res["resource_id"]
        ).first()
        if not existing_res:
            db.add(CloudResource(
                account_id="synthesis-demo",
                resource_id=res["resource_id"],
                resource_type=res["type"],
                name=res["name"],
                region=res["region"],
                service=res["service"],
                status=res["status"],
                monthly_cost=res["monthly_cost"],
                estimated_saving=res["estimated_saving"],
                risk_level=res["risk_level"],
                cpu_avg=res["cpu_avg"],
                tags_json=json.dumps(res["tags"]),
                launch_time=datetime.datetime.utcnow() - datetime.timedelta(days=45)
            ))
        else:
            existing_res.status = res["status"]
            existing_res.monthly_cost = res["monthly_cost"]
            existing_res.estimated_saving = res["estimated_saving"]

    # Recommendations & Approvals for synthesis-demo
    sample_recs = [
        {
            "rec_id": "rec_01_ec2_resize",
            "title": "Downsize Analytics Worker c5.4xlarge -> c5.2xlarge",
            "desc": "Average CPU 14.2%, P95 CPU 22.8%, Memory 9.4 GiB out of 32 GiB. Verified non-critical async ETL tier.",
            "category": "rightsizing",
            "service": "EC2",
            "resource_id": "i-08a9f24c7b8e1a3d",
            "monthly_cost": 496.40,
            "savings": 248.20,
            "action_type": "resize_instance",
            "payload": {"target_action": "resize_instance", "resource_id": "i-08a9f24c7b8e1a3d", "target_instance_type": "c5.2xlarge"}
        },
        {
            "rec_id": "rec_02_idle_sandbox",
            "title": "Terminate Stale Research ML Instance (g4dn.xlarge)",
            "desc": "19 days idle with < 1% CPU and zero GPU compute kernel executions. Snapshot backup verified.",
            "category": "idle_resource",
            "service": "EC2",
            "resource_id": "i-09f182c448bb92aa",
            "monthly_cost": 384.00,
            "savings": 384.00,
            "action_type": "stop_instance",
            "payload": {"target_action": "stop_instance", "resource_id": "i-09f182c448bb92aa"}
        },
        {
            "rec_id": "rec_03_unattached_ebs",
            "title": "Purge Unattached gp3 EBS Volumes (2,400 GB)",
            "desc": "Detached for 21 days following Kubernetes cluster node retirement. Verified zero mount operations.",
            "category": "ebs_cleanup",
            "service": "EBS",
            "resource_id": "vol-0e78291f09bb2a4c1",
            "monthly_cost": 192.00,
            "savings": 192.00,
            "action_type": "delete_volume",
            "payload": {"target_action": "delete_volume", "resource_id": "vol-0e78291f09bb2a4c1"}
        },
        {
            "rec_id": "rec_04_gp2_to_gp3",
            "title": "Convert EBS Volume from gp2 to gp3",
            "desc": "Converting legacy gp2 storage to gp3 reduces baseline costs by 20% while providing baseline 3,000 IOPS.",
            "category": "rightsizing",
            "service": "EBS",
            "resource_id": "vol-0a12b34c56de78f90",
            "monthly_cost": 50.00,
            "savings": 10.00,
            "action_type": "convert_gp2_to_gp3",
            "payload": {"target_action": "convert_gp2_to_gp3", "resource_id": "vol-0a12b34c56de78f90"}
        }
    ]

    for r in sample_recs:
        existing_rec = db.query(Recommendation).filter(Recommendation.rec_id == r["rec_id"]).first()
        if not existing_rec:
            db.add(Recommendation(
                account_id="synthesis-demo",
                rec_id=r["rec_id"],
                title=r["title"],
                description=r["desc"],
                category=r["category"],
                service=r["service"],
                resource_id=r["resource_id"],
                current_monthly_cost=r["monthly_cost"],
                estimated_savings_monthly=r["savings"],
                risk_level="low",
                action_type=r["action_type"],
                action_payload_json=json.dumps(r["payload"]),
                status="pending_approval"
            ))
        existing_appr = db.query(ApprovalRecord).filter(ApprovalRecord.recommendation_id == r["rec_id"]).first()
        if not existing_appr:
            action_hash = generate_action_hash(r["action_type"], r["resource_id"], r["payload"])
            db.add(ApprovalRecord(
                account_id="synthesis-demo",
                recommendation_id=r["rec_id"],
                approver_id="pending",
                approver_name="FinOps Governance",
                decision="pending",
                decision_notes="Automated recommendation from synthesis research benchmark.",
                action_hash=action_hash,
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
            ))

    demo_acc = db.query(AWSAccount).filter(AWSAccount.account_id == "synthesis-demo").first()
    if demo_acc:
        demo_acc.resource_count = len(sample_resources)

    db.commit()
