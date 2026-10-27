import logging
import datetime
from typing import Dict, Any, List, Optional
try:
    import boto3
    from botocore.exceptions import ClientError, BotoCoreError
except ImportError:
    boto3 = None
    ClientError = Exception
    BotoCoreError = Exception

logger = logging.getLogger("cloudsense.aws.collector")

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
        self.region_name = region_name
        self.role_arn = role_arn
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.session_token = session_token
        self.external_id = external_id
        self._session = None

    def _get_session(self):
        if not boto3:
            raise RuntimeError("boto3 is not installed or available in this environment.")

        if self._session:
            return self._session

        if self.role_arn:
            sts = boto3.client(
                "sts",
                region_name=self.region_name,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                aws_session_token=self.session_token
            )
            params = {
                "RoleArn": self.role_arn,
                "RoleSessionName": "CloudSenseCollectorSession",
                "DurationSeconds": 3600
            }
            if self.external_id:
                params["ExternalId"] = self.external_id

            assumed = sts.assume_role(**params)
            creds = assumed["Credentials"]
            self._session = boto3.Session(
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
                region_name=self.region_name
            )
        elif self.access_key_id and self.secret_access_key:
            self._session = boto3.Session(
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                aws_session_token=self.session_token,
                region_name=self.region_name
            )
        else:
            self._session = boto3.Session(region_name=self.region_name)

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
            logger.error("AWS STS connection test failed: %s", str(e))
            return {
                "success": False,
                "error": str(e)
            }

    def collect_cost_and_usage(self, days: int = 30) -> List[Dict[str, Any]]:
        """Queries AWS Cost Explorer (ce) for daily unblended spend by service."""
        try:
            session = self._get_session()
            ce = session.client("ce", region_name="us-east-1") # CE is us-east-1
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
                for group in period.get("Groups", []):
                    service_name = group["Keys"][0]
                    amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                    results.append({
                        "date": time_str,
                        "service": service_name,
                        "amount": amount
                    })
            return results
        except Exception as e:
            logger.warning("Cost Explorer query failed: %s", str(e))
            return []

    def discover_resources(self) -> List[Dict[str, Any]]:
        """Discovers running EC2, EBS, and RDS resources via AWS APIs."""
        resources = []
        try:
            session = self._get_session()
            ec2 = session.client("ec2")
            rds = session.client("rds")

            # 1. EC2 Instances
            instances_res = ec2.describe_instances()
            for r in instances_res.get("Reservations", []):
                for inst in r.get("Instances", []):
                    name_tag = next((t["Value"] for t in inst.get("Tags", []) if t["Key"] == "Name"), inst["InstanceId"])
                    resources.append({
                        "id": inst["InstanceId"],
                        "name": name_tag,
                        "type": "ec2_instance",
                        "service": "Amazon EC2",
                        "instanceType": inst.get("InstanceType", "unknown"),
                        "status": inst.get("State", {}).get("Name", "unknown"),
                        "region": self.region_name,
                        "monthlyCost": 180.0, # estimated default
                        "tags": {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                    })

            # 2. EBS Volumes
            vols_res = ec2.describe_volumes()
            for vol in vols_res.get("Volumes", []):
                attachments = vol.get("Attachments", [])
                status = "attached" if attachments else "unattached"
                name_tag = next((t["Value"] for t in vol.get("Tags", []) if t["Key"] == "Name"), vol["VolumeId"])
                resources.append({
                    "id": vol["VolumeId"],
                    "name": name_tag,
                    "type": "ebs_volume",
                    "service": "Amazon EBS",
                    "status": status,
                    "sizeGb": vol.get("Size", 0),
                    "volumeType": vol.get("VolumeType", "gp3"),
                    "region": self.region_name,
                    "monthlyCost": round(vol.get("Size", 0) * 0.08, 2),
                    "tags": {t["Key"]: t["Value"] for t in vol.get("Tags", [])}
                })

            # 3. RDS Instances
            dbs_res = rds.describe_db_instances()
            for db in dbs_res.get("DBInstances", []):
                resources.append({
                    "id": db["DBInstanceIdentifier"],
                    "name": db["DBInstanceIdentifier"],
                    "type": "rds_instance",
                    "service": "Amazon RDS",
                    "instanceType": db.get("DBInstanceClass", "unknown"),
                    "status": db.get("DBInstanceStatus", "available"),
                    "region": self.region_name,
                    "monthlyCost": 340.0,
                    "tags": {}
                })

        except Exception as e:
            logger.warning("Resource discovery encountered exception: %s", str(e))

        return resources

    collect_resources = discover_resources
