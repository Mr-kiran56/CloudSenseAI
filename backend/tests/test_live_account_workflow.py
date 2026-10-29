import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

import unittest
import json
import datetime
from sqlalchemy.orm import Session
from backend.app.db.session import SessionLocal, engine, Base
from backend.app.db.models import (
    AWSAccount,
    CloudResource,
    DailyCost,
    Recommendation,
    ApprovalRecord,
    RemediationJob,
    AuditEvent
)
from backend.app.aws.sync_pipeline import sync_live_aws_account
from backend.app.mcp.tools import MCPToolRegistry

class TestLiveAWSAccountWorkflow(unittest.TestCase):
    def setUp(self):
        self.db: Session = SessionLocal()
        self.test_account_id = "112233445566"
        
        # Clean up any existing test records
        self._cleanup()

        # Create a test AWS Account
        self.account = AWSAccount(
            account_id=self.test_account_id,
            name="FinOps Production Testing Account",
            alias="finops-prod-test",
            env="production",
            region="us-east-1",
            role_arn=f"arn:aws:iam::{self.test_account_id}:role/CloudSenseProductionRole",
            status="connected",
            monthly_spend=0.0,
            resource_count=0,
            is_demo=False
        )
        self.db.add(self.account)
        self.db.commit()
        self.db.refresh(self.account)

    def tearDown(self):
        self._cleanup()
        self.db.close()

    def _cleanup(self):
        self.db.query(RemediationJob).filter(RemediationJob.resource_id.like("test-%")).delete(synchronize_session=False)
        self.db.query(AuditEvent).filter(AuditEvent.target.like("test-%")).delete(synchronize_session=False)
        self.db.query(ApprovalRecord).filter(ApprovalRecord.account_id == self.test_account_id).delete(synchronize_session=False)
        self.db.query(Recommendation).filter(Recommendation.account_id == self.test_account_id).delete(synchronize_session=False)
        self.db.query(CloudResource).filter(CloudResource.account_id == self.test_account_id).delete(synchronize_session=False)
        self.db.query(DailyCost).filter(DailyCost.account_id == self.test_account_id).delete(synchronize_session=False)
        self.db.query(AWSAccount).filter(AWSAccount.account_id == self.test_account_id).delete(synchronize_session=False)
        self.db.commit()

    def test_end_to_end_pipeline(self):
        # 1. Simulate discovery and sync of AWS resources
        sample_resources = [
            {
                "id": "test-i-0abc1234def567890",
                "resourceId": "test-i-0abc1234def567890",
                "name": "analytics-ingestion-worker",
                "type": "ec2_instance",
                "service": "EC2",
                "instanceType": "c5.4xlarge",
                "status": "oversized",
                "region": "us-east-1",
                "monthlyCost": 496.40,
                "estimatedSaving": 248.20,
                "riskLevel": "low",
                "cpuAvg": 11.4,
                "tags": {"Environment": "production", "Role": "AnalyticsWorker"}
            },
            {
                "id": "test-i-0idle9876xyz123456",
                "resourceId": "test-i-0idle9876xyz123456",
                "name": "sandbox-ml-notebook",
                "type": "ec2_instance",
                "service": "EC2",
                "instanceType": "t3.2xlarge",
                "status": "idle",
                "region": "us-east-1",
                "monthlyCost": 242.94,
                "estimatedSaving": 242.94,
                "riskLevel": "low",
                "cpuAvg": 0.4,
                "tags": {"Environment": "dev", "AutoStop": "false"}
            },
            {
                "id": "test-vol-0unattached123456",
                "resourceId": "test-vol-0unattached123456",
                "name": "unattached-legacy-volume",
                "type": "ebs_volume",
                "service": "EBS",
                "volumeType": "gp3",
                "sizeGb": 500,
                "status": "idle",
                "region": "us-east-1",
                "monthlyCost": 40.00,
                "estimatedSaving": 40.00,
                "riskLevel": "low",
                "tags": {}
            }
        ]

        # Insert into CloudResource table
        for r in sample_resources:
            self.db.add(CloudResource(
                account_id=self.test_account_id,
                resource_id=r["id"],
                resource_type=r["type"],
                name=r["name"],
                region=r["region"],
                service=r["service"],
                status=r["status"],
                monthly_cost=r["monthlyCost"],
                estimated_saving=r["estimatedSaving"],
                risk_level=r["riskLevel"],
                cpu_avg=r.get("cpuAvg", 0.0),
                tags_json=json.dumps(r.get("tags", {}))
            ))

        # Add sample daily costs
        for day in range(1, 15):
            d_str = (datetime.date.today() - datetime.timedelta(days=day)).isoformat()
            self.db.add(DailyCost(
                account_id=self.test_account_id,
                date=d_str,
                service="Amazon EC2",
                cost_usd=24.50
            ))
            self.db.add(DailyCost(
                account_id=self.test_account_id,
                date=d_str,
                service="Amazon EBS",
                cost_usd=1.35
            ))

        self.account.resource_count = len(sample_resources)
        self.account.monthly_spend = round(sum(r["monthlyCost"] for r in sample_resources), 2)
        self.db.commit()

        # 2. Verify resources query for this account
        db_resources = self.db.query(CloudResource).filter(CloudResource.account_id == self.test_account_id).all()
        self.assertEqual(len(db_resources), 3)

        # 3. Generate recommendations and approvals
        from backend.app.aws.sync_pipeline import _upsert_recommendation_and_approval
        
        # Idle instance recommendation
        _upsert_recommendation_and_approval(
            db=self.db,
            account_id=self.test_account_id,
            rec_id=f"rec_{self.test_account_id}_idle_stop",
            title="Stop Idle EC2 Instance (sandbox-ml-notebook)",
            description="EC2 Instance test-i-0idle9876xyz123456 has averaged 0.4% CPU.",
            category="idle_resource",
            service="EC2",
            resource_id="test-i-0idle9876xyz123456",
            monthly_cost=242.94,
            savings=242.94,
            risk_level="low",
            action_type="stop_instance",
            payload={"action_type": "stop_instance", "resource_id": "test-i-0idle9876xyz123456"}
        )

        # Oversized instance recommendation
        _upsert_recommendation_and_approval(
            db=self.db,
            account_id=self.test_account_id,
            rec_id=f"rec_{self.test_account_id}_resize",
            title="Downsize Over-provisioned Instance (c5.4xlarge -> c5.2xlarge)",
            description="EC2 Instance test-i-0abc1234def567890 exhibits low compute demand.",
            category="rightsizing",
            service="EC2",
            resource_id="test-i-0abc1234def567890",
            monthly_cost=496.40,
            savings=248.20,
            risk_level="low",
            action_type="resize_instance",
            payload={"action_type": "resize_instance", "resource_id": "test-i-0abc1234def567890", "target_instance_type": "c5.2xlarge"}
        )
        self.db.commit()

        recs = self.db.query(Recommendation).filter(Recommendation.account_id == self.test_account_id).all()
        self.assertEqual(len(recs), 2)
        
        approvals = self.db.query(ApprovalRecord).filter(ApprovalRecord.account_id == self.test_account_id).all()
        self.assertEqual(len(approvals), 2)

        # 4. Test Approval Decision and MCP Execution
        target_appr = approvals[0]
        rec = recs[0]
        
        # Execute MCP remediation simulation
        mcp_res = MCPToolRegistry.execute_remediation(
            action_type=rec.action_type,
            resource={"id": rec.resource_id, "region": "us-east-1"},
            parameters=json.loads(rec.action_payload_json),
            approval_token=target_appr.action_hash,
            live_execution=False
        )
        self.assertTrue(mcp_res["success"])
        self.assertEqual(mcp_res["status"], "completed")

        # Record RemediationJob
        rem_job = RemediationJob(
            job_id="job_test_01",
            recommendation_id=rec.rec_id,
            approval_id=target_appr.id,
            action_type=rec.action_type,
            resource_id=rec.resource_id,
            status="completed",
            initiated_by="FinOps Lead",
            aws_request_id=mcp_res["aws_request_id"],
            execution_log="\n".join(mcp_res["execution_log"])
        )
        self.db.add(rem_job)
        rec.status = "executed"
        target_appr.decision = "approved"
        self.db.commit()

        # Verify job and recommendation state
        saved_job = self.db.query(RemediationJob).filter(RemediationJob.job_id == "job_test_01").first()
        self.assertIsNotNone(saved_job)
        self.assertEqual(saved_job.status, "completed")
        self.assertEqual(rec.status, "executed")
        self.assertEqual(target_appr.decision, "approved")

        print("SUCCESS: Full live AWS account pipeline end-to-end test passed successfully!")

if __name__ == "__main__":
    unittest.main()
