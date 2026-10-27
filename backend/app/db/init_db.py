import datetime
from sqlalchemy.orm import Session
from .session import engine, Base, SessionLocal
from .models import (
    User, AWSAccount, CloudResource, DailyCost, AnomalyIncident,
    Recommendation, ApprovalRecord, RemediationJob, AuditEvent,
    Notification, Integration, ModelRegistryRecord
)
from ..core.security import get_password_hash

def init_db():
    # Guarantee tables are created
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Seed Users - Strictly ONE Demo User (FinOps Lead & Admin for Demo Lab)
        legacy_users = db.query(User).filter(User.email.in_(["analyst@cloudsense.ai", "engineer@cloudsense.ai"])).all()
        if legacy_users:
            for u in legacy_users:
                db.delete(u)
            db.commit()
            print("Purged secondary mock users from database.")

        admin_user = db.query(User).filter(User.email == "admin@cloudsense.ai").first()
        if not admin_user:
            admin_user = User(
                email="admin@cloudsense.ai",
                hashed_password=get_password_hash("Admin@123456"),
                full_name="Kiran (FinOps Lead & Admin)",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Successfully initialized single demo admin user.")

        # Seed AWS Accounts - Strictly ONE Demo Account (Synthesis)
        # Purge legacy mock accounts if present
        legacy = db.query(AWSAccount).filter(AWSAccount.account_id.in_(["123456789012", "987654321098", "554433221100"])).all()
        if legacy:
            for acc in legacy:
                db.delete(acc)
            db.commit()
            print("Purged legacy mock accounts from database.")

        demo_acc = db.query(AWSAccount).filter(AWSAccount.account_id == "synthesis-demo").first()
        if not demo_acc:
            demo_account = AWSAccount(
                account_id="synthesis-demo",
                name="CloudSense Demo Lab (Synthesis)",
                alias="demo-synthesis-lab",
                env="demo",
                region="us-east-1",
                role_arn="arn:aws:iam::synthesis-demo:role/CloudSenseDemoLab",
                status="connected",
                monthly_spend=14280.0,
                resource_count=38,
                is_demo=True
            )
            db.add(demo_account)
            db.commit()
            print("Successfully initialized single Synthesis Demo AWS account.")

        # Seed Cloud Resources
        if db.query(CloudResource).count() == 0:
            resources = [
                CloudResource(
                    resource_id="i-08a9f24c7b8e1a3d",
                    resource_type="ec2_instance",
                    name="prod-analytics-worker-01",
                    region="us-east-1",
                    service="Amazon EC2",
                    status="running",
                    monthly_cost=768.0,
                    tags_json='{"Environment": "Production", "Owner": "DataPlatform"}',
                    cpu_avg=14.2,
                    memory_avg=28.5,
                    network_in=12000.0,
                    network_out=45000.0,
                    disk_io=850.0
                ),
                CloudResource(
                    resource_id="i-09f182c448bb92aa",
                    resource_type="ec2_instance",
                    name="dev-sandbox-ml-train",
                    region="us-west-2",
                    service="Amazon EC2",
                    status="idle",
                    monthly_cost=412.0,
                    tags_json='{"Environment": "Development", "Team": "MLResearch"}',
                    cpu_avg=0.8,
                    memory_avg=4.1,
                    network_in=15.0,
                    network_out=10.0,
                    disk_io=0.0
                ),
                CloudResource(
                    resource_id="vol-0e78291f09bb2a4c1",
                    resource_type="ebs_volume",
                    name="unattached-db-backup-gp3",
                    region="us-east-1",
                    service="Amazon EBS",
                    status="unattached",
                    monthly_cost=185.0,
                    tags_json='{"Lifecycle": "Orphaned"}',
                    cpu_avg=0.0,
                    memory_avg=0.0,
                    network_in=0.0,
                    network_out=0.0,
                    disk_io=0.0
                )
            ]
            db.add_all(resources)
            db.commit()
            print("Successfully initialized Cloud Resources.")

        # Seed Model Registry
        if db.query(ModelRegistryRecord).count() == 0:
            models_info = [
                ModelRegistryRecord(
                    model_name="prophet_cost",
                    version="1.0.0",
                    variant="P3_tuned",
                    metrics_json='{"cv_mape_30d": 0.087, "holdout_mape_30d": 0.048, "rmse": 18.42}',
                    parameters_json='{"growth": "linear", "interval_width": 0.80, "seasonality_mode": "additive"}',
                    artifact_path="outputs_model_a/artifacts/model_registry/prophet_cost",
                    active=True
                ),
                ModelRegistryRecord(
                    model_name="xgb_unit_economics",
                    version="1.0.0",
                    variant="xgb_final_refit",
                    metrics_json='{"test_mae": 0.00095, "test_r2": 0.994, "test_mape": 0.046}',
                    parameters_json='{"n_estimators": 500, "max_depth": 6, "learning_rate": 0.05}',
                    artifact_path="outputs_model_b/artifacts/model_registry/xgb_unit_economics",
                    active=True
                ),
                ModelRegistryRecord(
                    model_name="isoforest_anomaly",
                    version="1.0.0",
                    variant="HYBRID_IF_zrule",
                    metrics_json='{"any_anomaly_auprc": 0.83, "median_delay_min": 5.0}',
                    parameters_json='{"threshold": 11.2454, "n_estimators": 200, "contamination": 0.01}',
                    artifact_path="outputs_model_c/artifacts/model_registry/isoforest_extended",
                    active=True
                )
            ]
            db.add_all(models_info)
            db.commit()
            print("Successfully initialized Model Registry.")

    except Exception as e:
        db.rollback()
        print("Database initialization notice:", e)
    finally:
        db.close()

# Run immediately when loaded so tables always exist
init_db()
