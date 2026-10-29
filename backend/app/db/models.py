import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from .session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="cloud_engineer")  # admin, finops_analyst, cloud_engineer, viewer
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AWSAccount(Base):
    __tablename__ = "aws_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(255), nullable=True)
    account_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    alias = Column(String(100), nullable=True)
    env = Column(String(50), default="production")  # production, staging, dev, demo
    region = Column(String(64), default="us-east-1")
    role_arn = Column(String(255), nullable=True)
    access_key_id = Column(Text, nullable=True)
    secret_access_key = Column(Text, nullable=True)
    external_id = Column(String(128), nullable=True)
    status = Column(String(50), default="connected")  # connected, degraded, pending, error
    monthly_spend = Column(Float, default=0.0)
    resource_count = Column(Integer, default=0)
    is_demo = Column(Boolean, default=False)
    last_synced = Column(DateTime, default=datetime.datetime.utcnow)

class CloudResource(Base):
    __tablename__ = "cloud_resources"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(64), index=True, default="synthesis-demo")
    resource_id = Column(String(255), unique=True, index=True, nullable=False)
    resource_type = Column(String(100), nullable=False)  # ec2_instance, ebs_volume, rds_instance, lambda_function, nat_gateway
    name = Column(String(255), nullable=False)
    region = Column(String(64), default="us-east-1")
    service = Column(String(64), nullable=False)  # Amazon EC2, Amazon RDS, Amazon S3, AWS Lambda
    status = Column(String(50), default="running")  # running, idle, stopped, unattached, oversized, critical
    monthly_cost = Column(Float, default=0.0)
    estimated_saving = Column(Float, default=0.0)
    risk_level = Column(String(32), default="low")
    tags_json = Column(Text, default="{}")
    cpu_avg = Column(Float, default=0.0)
    memory_avg = Column(Float, default=0.0)
    network_in = Column(Float, default=0.0)  # MB/day
    network_out = Column(Float, default=0.0)  # MB/day
    disk_io = Column(Float, default=0.0)
    launch_time = Column(DateTime, default=datetime.datetime.utcnow)

class DailyCost(Base):
    __tablename__ = "daily_costs"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(32), index=True, nullable=False)
    date = Column(String(32), index=True, nullable=False)  # YYYY-MM-DD
    service = Column(String(100), index=True, nullable=False)
    cost_usd = Column(Float, nullable=False)
    cost_basis = Column(String(100), default="net unblended cost, USD")
    currency = Column(String(10), default="USD")

class MetricDataPoint(Base):
    __tablename__ = "metric_data_points"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(String(255), index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    metric_name = Column(String(100), index=True, nullable=False)  # CPUUtilization, NetworkIn, CostVelocity, ProvisioningFrequency
    value = Column(Float, nullable=False)
    unit = Column(String(50), default="Percent")

class BusinessKPI(Base):
    __tablename__ = "business_kpis"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(32), unique=True, index=True, nullable=False)  # YYYY-MM-DD
    active_users = Column(Integer, default=0)
    api_requests = Column(Float, default=0.0)
    transactions = Column(Integer, default=0)
    workload_intensity = Column(Float, default=1.0)

class AnomalyIncident(Base):
    __tablename__ = "anomaly_incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(64), unique=True, index=True, nullable=False)
    account_id = Column(String(64), index=True, nullable=True)
    title = Column(String(255), nullable=False)
    service = Column(String(100), nullable=False)
    resource_id = Column(String(255), nullable=True)
    score = Column(Float, nullable=False)
    threshold = Column(Float, default=11.24)
    severity = Column(String(32), default="medium")  # critical, high, medium, low
    status = Column(String(50), default="open")  # open, investigating, resolved, false_positive
    triage_class = Column(String(50), default="dow_candidate")  # dow_candidate, benign_spike, operational_anomaly
    root_cause = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    evidence_json = Column(Text, default="{}")

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(64), index=True, default="synthesis-demo")
    rec_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(64), default="rightsizing")  # rightsizing, idle_resource, reservations, ebs_cleanup
    service = Column(String(100), nullable=False)
    resource_id = Column(String(255), nullable=False)
    current_monthly_cost = Column(Float, default=0.0)
    estimated_savings_monthly = Column(Float, default=0.0)
    estimated_savings_low = Column(Float, default=0.0)
    estimated_savings_high = Column(Float, default=0.0)
    risk_level = Column(String(32), default="low")  # low, medium, high
    confidence = Column(Float, default=0.95)
    roi_percent = Column(Float, default=0.0)
    action_type = Column(String(64), nullable=False)  # resize_instance, terminate_instance, delete_volume, schedule_stop
    action_payload_json = Column(Text, default="{}")
    status = Column(String(50), default="pending_approval")  # pending_approval, approved, rejected, executed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(64), index=True, default="synthesis-demo")
    recommendation_id = Column(String(64), index=True, nullable=False)
    approver_id = Column(String(100), nullable=False)
    approver_name = Column(String(255), nullable=False)
    decision = Column(String(32), nullable=False)  # approved, rejected
    decision_notes = Column(Text, nullable=True)
    action_hash = Column(String(128), nullable=False)
    approved_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

class RemediationJob(Base):
    __tablename__ = "remediation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(64), unique=True, index=True, nullable=False)
    recommendation_id = Column(String(64), index=True, nullable=False)
    approval_id = Column(Integer, nullable=True)
    action_type = Column(String(64), nullable=False)
    resource_id = Column(String(255), nullable=False)
    status = Column(String(50), default="completed")  # queued, running, completed, failed, rolled_back
    initiated_by = Column(String(255), default="FinOps System")
    initiated_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    dry_run = Column(Boolean, default=False)
    rollback_available = Column(Boolean, default=True)
    execution_log = Column(Text, default="")
    aws_request_id = Column(String(128), nullable=True)

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    actor = Column(String(255), nullable=False)
    action = Column(String(128), nullable=False)
    target = Column(String(255), nullable=False)
    target_type = Column(String(64), nullable=False)
    status = Column(String(32), default="SUCCESS")  # SUCCESS, FAILED, DENIED
    details_json = Column(Text, default="{}")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String(64), default="127.0.0.1")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    account_id = Column(String(64), index=True, nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(32), default="info")  # info, warning, critical, success
    category = Column(String(64), default="finops")  # anomaly, approval, budget, forecast
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    link = Column(String(255), nullable=True)

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    type = Column(String(64), nullable=False)  # slack, webhook, pagerduty, aws_cur, aws_cloudwatch
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="active")  # active, paused, disconnected
    config_json = Column(Text, default="{}")
    enabled = Column(Boolean, default=True)

class ModelRegistryRecord(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(64), index=True, nullable=False)  # prophet_cost, xgb_unit_economics, isoforest_anomaly
    version = Column(String(32), nullable=False)
    variant = Column(String(64), nullable=False)
    train_date = Column(DateTime, default=datetime.datetime.utcnow)
    metrics_json = Column(Text, default="{}")
    parameters_json = Column(Text, default="{}")
    artifact_path = Column(String(500), nullable=False)
    active = Column(Boolean, default=True)
