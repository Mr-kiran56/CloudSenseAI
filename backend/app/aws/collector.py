import logging
import datetime
from typing import Dict, Any, List, Optional, Tuple

try:
    import boto3
    from botocore.exceptions import ClientError, BotoCoreError
except ImportError:
    boto3 = None
    ClientError = Exception
    BotoCoreError = Exception

logger = logging.getLogger("cloudsense.aws.collector")

# Approximate monthly costs (730 hrs on-demand) for common EC2 instance types
EC2_ON_DEMAND_MONTHLY_PRICING: Dict[str, float] = {
    # General Purpose (t3 / t4g / m5 / m6i)
    "t3.nano": 3.80, "t3.micro": 7.60, "t3.small": 15.18, "t3.medium": 30.37,
    "t3.large": 60.74, "t3.xlarge": 121.47, "t3.2xlarge": 242.94,
    "t2.nano": 4.23, "t2.micro": 8.47, "t2.small": 16.79, "t2.medium": 33.87, "t2.large": 67.74,
    "t4g.nano": 3.07, "t4g.micro": 6.13, "t4g.small": 12.26, "t4g.medium": 24.53,
    "t4g.large": 49.06, "t4g.xlarge": 98.11, "t4g.2xlarge": 196.22,
    "m5.large": 70.08, "m5.xlarge": 140.16, "m5.2xlarge": 280.32, "m5.4xlarge": 560.64,
    "m6i.large": 70.08, "m6i.xlarge": 140.16, "m6i.2xlarge": 280.32, "m6i.4xlarge": 560.64,
    # Compute Optimized (c5 / c6i)
    "c5.large": 62.05, "c5.xlarge": 124.10, "c5.2xlarge": 248.20, "c5.4xlarge": 496.40, "c5.9xlarge": 1116.90,
    "c6i.large": 62.05, "c6i.xlarge": 124.10, "c6i.2xlarge": 248.20, "c6i.4xlarge": 496.40,
    # Memory Optimized (r5 / r6i)
    "r5.large": 91.98, "r5.xlarge": 183.96, "r5.2xlarge": 367.92, "r5.4xlarge": 735.84,
    "r6i.large": 91.98, "r6i.xlarge": 183.96, "r6i.2xlarge": 367.92,
    # Accelerated Computing
    "g4dn.xlarge": 384.00, "g4dn.2xlarge": 549.00, "g5.xlarge": 734.00,
}

DOWNSIZE_TARGET_MAP: Dict[str, str] = {
    "c5.4xlarge": "c5.2xlarge",
    "c5.2xlarge": "c5.xlarge",
    "c5.xlarge": "c5.large",
    "c6i.4xlarge": "c6i.2xlarge",
    "c6i.2xlarge": "c6i.xlarge",
    "c6i.xlarge": "c6i.large",
    "m5.4xlarge": "m5.2xlarge",
    "m5.2xlarge": "m5.xlarge",
    "m5.xlarge": "m5.large",
    "m6i.4xlarge": "m6i.2xlarge",
    "m6i.2xlarge": "m6i.xlarge",
    "m6i.xlarge": "m6i.large",
    "r5.4xlarge": "r5.2xlarge",
    "r5.2xlarge": "r5.xlarge",
    "r5.xlarge": "r5.large",
    "t3.2xlarge": "t3.xlarge",
    "t3.xlarge": "t3.large",
    "t3.large": "t3.medium",
    "t3.medium": "t3.small",
    "t4g.2xlarge": "t4g.xlarge",
    "t4g.xlarge": "t4g.large",
    "t4g.large": "t4g.medium",
    "t4g.medium": "t4g.small",
}

class AWSDataCollector:
    """Connects to live AWS accounts via Boto3 (IAM Role Assumption or Access Keys)
    to ingest Billing, CloudWatch Telemetry, and Resource Configurations."""

    def __init__(
        self,
        region_name: str = "us-east-1",
        role_arn: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        session_token: Optional[str] = None,
        external_id: Optional[str] = None
    ):
        self.region_name = region_name or "us-east-1"
        self.role_arn = role_arn
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.session_token = session_token
        self.external_id = external_id
        self._session = None
        self._assumed_creds = None
        self._scp_restricted = False

    def _get_session(self):
        if not boto3:
            raise RuntimeError("boto3 is not installed or available in this environment.")

        if self._session:
            return self._session

        if self.role_arn:
            if not self._assumed_creds:
                sts_kwargs = {"region_name": "us-east-1"}
                if self.access_key_id and self.secret_access_key:
                    sts_kwargs.update(
                        aws_access_key_id=self.access_key_id,
                        aws_secret_access_key=self.secret_access_key,
                        aws_session_token=self.session_token,
                    )
                sts = boto3.client("sts", **sts_kwargs)
                params = {
                    "RoleArn": self.role_arn,
                    "RoleSessionName": "CloudSenseCollectorSession",
                    "DurationSeconds": 3600
                }
                if self.external_id:
                    params["ExternalId"] = self.external_id

                assumed = sts.assume_role(**params)
                self._assumed_creds = assumed["Credentials"]

            self._session = boto3.Session(
                aws_access_key_id=self._assumed_creds["AccessKeyId"],
                aws_secret_access_key=self._assumed_creds["SecretAccessKey"],
                aws_session_token=self._assumed_creds["SessionToken"],
                region_name=self.region_name or "us-east-1"
            )
        elif self.access_key_id and self.secret_access_key:
            self._session = boto3.Session(
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                aws_session_token=self.session_token,
                region_name=self.region_name or "us-east-1"
            )
        else:
            self._session = boto3.Session(region_name=self.region_name or "us-east-1")

        return self._session

    def test_connection(self) -> Dict[str, Any]:
        """Validates connection by querying AWS STS GetCallerIdentity."""
        try:
            session = self._get_session()
            sts = session.client("sts")
            identity = sts.get_caller_identity()
            return {
                "success": True,
                "account_id": identity.get("Account"),
                "arn": identity.get("Arn"),
                "user_id": identity.get("UserId")
            }
        except Exception as e:
            err_msg = str(e)
            if "InvalidClientTokenId" in err_msg:
                err_msg = (
                    "AWS STS Authentication Notice (InvalidClientTokenId): "
                    "The base AWS credentials on this system (~/.aws/credentials) are expired or invalid. "
                    "To assume an IAM Role, your host environment or request must provide active AWS credentials "
                    "with sts:AssumeRole permission."
                )
            elif "AccessDenied" in err_msg:
                err_msg = (
                    f"AWS STS AccessDenied: Not authorized to assume role {self.role_arn}. "
                    "Verify the IAM Role's Trust Relationship and External ID in AWS Console."
                )
            logger.error("AWS STS connection test failed: %s", err_msg)
            return {
                "success": False,
                "error": err_msg
            }

    def collect_cost_and_usage(self, days: int = 30) -> List[Dict[str, Any]]:
        """Queries AWS Cost Explorer (ce) for daily unblended spend by service."""
        try:
            session = self._get_session()
            ce = session.client("ce", region_name="us-east-1")  # Cost Explorer endpoint is us-east-1
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=days)

            response = ce.get_cost_and_usage(
                TimePeriod={
                    "Start": start_date.isoformat(),
                    "End": end_date.isoformat()
                },
                Granularity="DAILY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
            )
            results = []
            for period in response.get("ResultsByTime", []):
                time_str = period["TimePeriod"]["Start"]
                groups = period.get("Groups", [])
                if groups:
                    for group in groups:
                        service_name = group["Keys"][0]
                        amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                        results.append({
                            "date": time_str,
                            "service": service_name,
                            "amount": round(amount, 2)
                        })
                elif "Total" in period and "UnblendedCost" in period["Total"]:
                    amount = float(period["Total"]["UnblendedCost"].get("Amount", 0.0))
                    results.append({
                        "date": time_str,
                        "service": "AWS Services",
                        "amount": round(amount, 2)
                    })
            return results
        except Exception as e:
            logger.warning("Cost Explorer query warning: %s", str(e))
            return []

    def get_instance_cpu_metrics(self, instance_id: str, days: int = 7) -> Tuple[Optional[float], Optional[float]]:
        """Queries CloudWatch for average and maximum CPU utilization over the past days."""
        try:
            session = self._get_session()
            cw = session.client("cloudwatch", region_name=self.region_name)
            end_time = datetime.datetime.utcnow()
            start_time = end_time - datetime.timedelta(days=days)

            res = cw.get_metric_statistics(
                Namespace="AWS/EC2",
                MetricName="CPUUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,  # 1 day aggregated datapoints
                Statistics=["Average", "Maximum"]
            )
            datapoints = res.get("Datapoints", [])
            if not datapoints:
                return None, None
            avg_cpu = sum(d.get("Average", 0.0) for d in datapoints) / len(datapoints)
            max_cpu = max(d.get("Maximum", 0.0) for d in datapoints)
            return round(avg_cpu, 1), round(max_cpu, 1)
        except Exception as e:
            logger.debug("CloudWatch metric query for %s returned notice: %s", instance_id, e)
            return None, None

    def _discover_in_current_region(self) -> List[Dict[str, Any]]:
        """Discovers EC2, EBS, RDS, S3, and Lambda resources in the current region."""
        resources = []
        session = self._get_session()

        # 1. EC2 Instances
        try:
            ec2 = session.client("ec2", region_name=self.region_name)
            instances_res = ec2.describe_instances()
            for r in instances_res.get("Reservations", []):
                for inst in r.get("Instances", []):
                    inst_id = inst["InstanceId"]
                    name_tag = next((t["Value"] for t in inst.get("Tags", []) if t["Key"] == "Name"), inst_id)
                    inst_type = inst.get("InstanceType", "t3.medium")
                    state = inst.get("State", {}).get("Name", "running")
                    
                    # Estimate monthly cost based on instance type
                    monthly_cost = EC2_ON_DEMAND_MONTHLY_PRICING.get(inst_type, 65.0)

                    # Query real CloudWatch CPU utilization
                    cpu_avg, cpu_max = self.get_instance_cpu_metrics(inst_id)

                    # Classification logic
                    if state in ["stopped", "stopping"]:
                        res_status = "stopped"
                        saving = 0.0
                        risk = "low"
                    elif cpu_avg is not None and cpu_avg < 4.0:
                        res_status = "idle"
                        saving = round(monthly_cost, 2)
                        risk = "low"
                    elif cpu_avg is not None and cpu_avg < 20.0:
                        res_status = "oversized"
                        target_type = DOWNSIZE_TARGET_MAP.get(inst_type, "t3.large")
                        target_cost = EC2_ON_DEMAND_MONTHLY_PRICING.get(target_type, monthly_cost * 0.5)
                        saving = round(max(0.0, monthly_cost - target_cost), 2)
                        risk = "low"
                    elif cpu_avg is not None and cpu_avg > 80.0:
                        res_status = "critical"
                        saving = 0.0
                        risk = "critical"
                    else:
                        res_status = "healthy" if state == "running" else state
                        saving = 0.0
                        risk = "low"

                    tags_dict = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                    resources.append({
                        "id": inst_id,
                        "resourceId": inst_id,
                        "name": name_tag,
                        "type": "ec2_instance",
                        "service": "EC2",
                        "instanceType": inst_type,
                        "status": res_status,
                        "region": self.region_name,
                        "monthlyCost": round(monthly_cost, 2),
                        "estimatedSaving": saving,
                        "riskLevel": risk,
                        "cpuAvg": cpu_avg if cpu_avg is not None else 0.0,
                        "tags": tags_dict,
                        "environment": tags_dict.get("Environment", "production").lower(),
                        "launchTime": inst.get("LaunchTime").isoformat() if inst.get("LaunchTime") else None
                    })
        except Exception as e:
            if "service control policy" in str(e).lower() or "unauthorizedoperation" in str(e).lower():
                self._scp_restricted = True
            logger.warning("EC2 discovery failed or partial: %s", str(e))

        # 2. EBS Volumes
        try:
            ec2 = session.client("ec2", region_name=self.region_name)
            vols_res = ec2.describe_volumes()
            for vol in vols_res.get("Volumes", []):
                vol_id = vol["VolumeId"]
                attachments = vol.get("Attachments", [])
                vol_type = vol.get("VolumeType", "gp3")
                size_gb = vol.get("Size", 100)
                name_tag = next((t["Value"] for t in vol.get("Tags", []) if t["Key"] == "Name"), vol_id)

                if vol_type == "gp3":
                    monthly_cost = round(size_gb * 0.08, 2)
                elif vol_type == "gp2":
                    monthly_cost = round(size_gb * 0.10, 2)
                else:
                    monthly_cost = round(size_gb * 0.125, 2)

                if not attachments:
                    res_status = "idle"  # unattached
                    saving = monthly_cost
                    risk = "low"
                elif vol_type == "gp2":
                    res_status = "oversized"  # convert gp2 to gp3
                    saving = round(size_gb * 0.02, 2)
                    risk = "low"
                else:
                    res_status = "healthy"
                    saving = 0.0
                    risk = "low"

                tags_dict = {t["Key"]: t["Value"] for t in vol.get("Tags", [])}
                resources.append({
                    "id": vol_id,
                    "resourceId": vol_id,
                    "name": name_tag,
                    "type": "ebs_volume",
                    "service": "EBS",
                    "status": res_status,
                    "sizeGb": size_gb,
                    "volumeType": vol_type,
                    "region": self.region_name,
                    "monthlyCost": monthly_cost,
                    "estimatedSaving": saving,
                    "riskLevel": risk,
                    "tags": tags_dict,
                    "environment": tags_dict.get("Environment", "production").lower()
                })
        except Exception as e:
            logger.warning("EBS discovery failed: %s", str(e))

        # 3. RDS Instances
        try:
            rds = session.client("rds", region_name=self.region_name)
            dbs_res = rds.describe_db_instances()
            for db in dbs_res.get("DBInstances", []):
                db_id = db["DBInstanceIdentifier"]
                db_class = db.get("DBInstanceClass", "db.t3.medium")
                db_status = db.get("DBInstanceStatus", "available")
                cost_est = 140.0 if "t3" in db_class else (380.0 if "r5" in db_class else 240.0)
                resources.append({
                    "id": db_id,
                    "resourceId": db_id,
                    "name": db_id,
                    "type": "rds_instance",
                    "service": "RDS",
                    "instanceType": db_class,
                    "status": "healthy" if db_status == "available" else "degraded",
                    "region": self.region_name,
                    "monthlyCost": cost_est,
                    "estimatedSaving": 0.0,
                    "riskLevel": "low",
                    "tags": {},
                    "environment": "production"
                })
        except Exception as e:
            logger.warning("RDS discovery failed or permissions absent: %s", str(e))

        # 4. S3 Buckets (Global service; query only once in primary region)
        if self.region_name in ["us-east-1", "global"]:
            try:
                s3 = session.client("s3", region_name="us-east-1")
                s3_res = s3.list_buckets()
                for b in s3_res.get("Buckets", []):
                    b_name = b["Name"]
                    resources.append({
                        "id": f"s3-{b_name}",
                        "resourceId": b_name,
                        "name": b_name,
                        "type": "s3_bucket",
                        "service": "S3",
                        "status": "healthy",
                        "region": "us-east-1",
                        "monthlyCost": 0.0,
                        "estimatedSaving": 0.0,
                        "riskLevel": "low",
                        "tags": {},
                        "environment": "production"
                    })
            except Exception as e:
                logger.debug("S3 discovery notice: %s", str(e))

        # 5. AWS Lambda Functions
        try:
            lambda_client = session.client("lambda", region_name=self.region_name)
            funcs = lambda_client.list_functions()
            for fn in funcs.get("Functions", []):
                fn_name = fn["FunctionName"]
                resources.append({
                    "id": fn.get("FunctionArn", f"lambda-{fn_name}"),
                    "resourceId": fn_name,
                    "name": fn_name,
                    "type": "lambda_function",
                    "service": "Lambda",
                    "status": "healthy",
                    "region": self.region_name,
                    "monthlyCost": 0.0,
                    "estimatedSaving": 0.0,
                    "riskLevel": "low",
                    "tags": {},
                    "environment": "production"
                })
        except Exception as e:
            logger.debug("Lambda discovery notice: %s", str(e))

        return resources

    def discover_resources(self) -> List[Dict[str, Any]]:
        primary_region = self.region_name or "us-east-1"
        regions = [primary_region]
        try:
            session = self._get_session()
            ec2 = session.client("ec2", region_name=primary_region)
            described = ec2.describe_regions(AllRegions=False)
            extra = [r.get("RegionName") for r in described.get("Regions", []) if r.get("RegionName")]
            for region in extra:
                if region not in regions:
                    regions.append(region)
        except Exception as e:
            logger.debug("Region enumeration limited to %s: %s", primary_region, e)

        original_region = self.region_name
        merged: List[Dict[str, Any]] = []
        seen = set()
        scp_blocked = False
        try:
            for region in regions[:6]:
                if (scp_blocked or self._scp_restricted) and region != primary_region:
                    logger.info("SCP restrictions detected; skipping cross-region scan beyond %s", primary_region)
                    break
                self.region_name = region
                self._session = None
                try:
                    for resource in self._discover_in_current_region():
                        rid = resource.get("id")
                        if rid in seen:
                            continue
                        seen.add(rid)
                        merged.append(resource)
                except Exception as reg_err:
                    err_msg = str(reg_err).lower()
                    if "service control policy" in err_msg or "unauthorizedoperation" in err_msg:
                        scp_blocked = True
                    logger.debug("Discovery in region %s skipped: %s", region, reg_err)
        finally:
            self.region_name = original_region
            self._session = None
        return merged

    collect_resources = discover_resources
