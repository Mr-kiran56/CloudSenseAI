import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db
from ...db.models import AWSAccount, CloudResource, DailyCost
from ...db.schemas import AWSAccountCreate, AWSAccountTestRequest
from ...aws.collector import AWSDataCollector

logger = logging.getLogger("cloudsense.api.accounts")
router = APIRouter(prefix="/cloud-accounts", tags=["Cloud Accounts"])

def format_account(acc: AWSAccount) -> Dict[str, Any]:
    acc_id_str = f"acc_{acc.id}" if not acc.is_demo else "synthesis-lab-01"
    last_sync_str = (
        "Real-time ML Active"
        if acc.is_demo
        else (acc.last_synced.strftime("%b %d, %H:%M UTC") if acc.last_synced else "Pending initial sync")
    )
    return {
        "id": acc_id_str,
        "accountId": acc.account_id,
        "name": acc.name,
        "alias": acc.alias or acc.name.lower().replace(" ", "-"),
        "env": acc.env or "production",
        "region": acc.region or "us-east-1",
        "status": acc.status or "connected",
        "lastSync": last_sync_str,
        "resourceCount": acc.resource_count or 0,
        "monthlySpend": float(acc.monthly_spend or 0.0),
        "isDemo": bool(acc.is_demo),
        "roleArn": acc.role_arn,
    }

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_cloud_accounts(db: Session = Depends(get_db)):
    """Retrieve all authorized AWS accounts.
    Strictly maintains ONE demo account (Synthesis) alongside connected real AWS accounts."""
    accounts = db.query(AWSAccount).all()
    
    # If no accounts exist yet in DB, ensure the single Synthesis demo account is seeded
    demo_found = any(a.is_demo or a.account_id == "synthesis-demo" for a in accounts)
    if not demo_found:
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
            is_demo=True,
            last_synced=datetime.datetime.utcnow()
        )
        db.add(demo_account)
        db.commit()
        db.refresh(demo_account)
        accounts.append(demo_account)

    return [format_account(acc) for acc in accounts]

@router.post("/test-connection")
def test_aws_connection(req: AWSAccountTestRequest):
    """Test AWS STS connection using provided IAM Role ARN or Access Keys."""
    collector = AWSDataCollector(
        region_name=req.region or "us-east-1",
        role_arn=req.role_arn,
        access_key_id=req.access_key_id,
        secret_access_key=req.secret_access_key,
        external_id=req.external_id
    )
    result = collector.test_connection()
    return result

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def connect_aws_account(req: AWSAccountCreate, db: Session = Depends(get_db)):
    """Connect and persist a real AWS cloud account via IAM Cross-Account Role or API Keys."""
    # Check if account_id already registered
    existing = db.query(AWSAccount).filter(AWSAccount.account_id == req.account_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AWS Account ID {req.account_id} is already connected."
        )

    # Validate STS connectivity if requested and credentials are provided
    verified_arn = req.role_arn
    connection_status = "connected"
    if req.test_connection and (req.role_arn or (req.access_key_id and req.secret_access_key)):
        collector = AWSDataCollector(
            region_name=req.region or "us-east-1",
            role_arn=req.role_arn,
            access_key_id=req.access_key_id,
            secret_access_key=req.secret_access_key,
            external_id=req.external_id
        )
        test_res = collector.test_connection()
        if not test_res.get("success"):
            logger.warning("AWS connection test warning: %s", test_res.get("error"))
            connection_status = "degraded"
        else:
            verified_arn = test_res.get("arn", req.role_arn)

    new_account = AWSAccount(
        account_id=req.account_id,
        name=req.name,
        alias=req.alias or req.name.lower().replace(" ", "-"),
        env=req.env or "production",
        region=req.region or "us-east-1",
        role_arn=verified_arn,
        access_key_id=req.access_key_id,
        secret_access_key=req.secret_access_key,
        external_id=req.external_id,
        status=connection_status,
        monthly_spend=0.0,
        resource_count=0,
        is_demo=False,
        last_synced=datetime.datetime.utcnow()
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    # Initial live discovery if credentials are valid
    try:
        if req.role_arn or (req.access_key_id and req.secret_access_key):
            collector = AWSDataCollector(
                region_name=req.region or "us-east-1",
                role_arn=req.role_arn,
                access_key_id=req.access_key_id,
                secret_access_key=req.secret_access_key,
                external_id=req.external_id
            )
            # Ingest resources
            resources = collector.collect_resources()
            new_account.resource_count = len(resources)
            # Ingest cost
            costs = collector.collect_cost_and_usage(days=30)
            if costs:
                new_account.monthly_spend = round(sum(c.get("amount", c.get("cost_usd", 0.0)) for c in costs), 2)
                for c in costs:
                    cost_val = c.get("amount", c.get("cost_usd", 0.0))
                    db.add(DailyCost(
                        account_id=new_account.account_id,
                        date=c["date"],
                        service=c["service"],
                        cost_usd=cost_val
                    ))
            db.commit()
            db.refresh(new_account)
    except Exception as e:
        logger.error("Initial discovery error for account %s: %s", req.account_id, e)

    return format_account(new_account)

@router.post("/{account_id}/sync")
def sync_aws_account(account_id: str, db: Session = Depends(get_db)):
    """Trigger live Boto3 telemetry and cost sync for the specified account."""
    target_id = "synthesis-demo" if account_id == "synthesis-lab-01" else account_id
    clean_id = target_id.replace("acc_", "")
    account = (
        db.query(AWSAccount)
        .filter(
            (AWSAccount.account_id == target_id)
            | (AWSAccount.id == (int(clean_id) if clean_id.isdigit() else -1))
        )
        .first()
    )

    if not account:
        if account_id in ["synthesis-demo", "synthesis-lab-01"]:
            return {
                "success": True,
                "message": "CloudSense Demo Lab (Synthesis) active with continuous live ML inference.",
                "last_synced": datetime.datetime.utcnow().isoformat()
            }
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AWS Account not found.")

    if account.is_demo:
        account.last_synced = datetime.datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "message": "Synthesis Demo Lab benchmark telemetry verified.",
            "last_synced": account.last_synced.isoformat(),
            "resources": account.resource_count,
            "monthly_spend": account.monthly_spend
        }

    # Live account synchronization via Boto3
    collector = AWSDataCollector(
        region_name=account.region or "us-east-1",
        role_arn=account.role_arn,
        access_key_id=account.access_key_id,
        secret_access_key=account.secret_access_key,
        external_id=account.external_id
    )

    try:
        resources = collector.collect_resources()
        costs = collector.collect_cost_and_usage(days=30)
        
        account.resource_count = len(resources) if resources else account.resource_count
        if costs:
            account.monthly_spend = round(sum(c.get("amount", c.get("cost_usd", 0.0)) for c in costs), 2)
            for c in costs:
                cost_val = c.get("amount", c.get("cost_usd", 0.0))
                existing_dc = db.query(DailyCost).filter(
                    DailyCost.account_id == account.account_id,
                    DailyCost.date == c["date"],
                    DailyCost.service == c["service"]
                ).first()
                if existing_dc:
                    existing_dc.cost_usd = cost_val
                else:
                    db.add(DailyCost(
                        account_id=account.account_id,
                        date=c["date"],
                        service=c["service"],
                        cost_usd=cost_val
                    ))
        account.status = "connected"
        account.last_synced = datetime.datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "message": f"Successfully synchronized {len(resources)} AWS resources and latest Cost Explorer telemetry.",
            "last_synced": account.last_synced.isoformat(),
            "resources": account.resource_count,
            "monthly_spend": account.monthly_spend
        }
    except Exception as e:
        logger.error("Failed live sync for account %s: %s", account.account_id, e)
        account.status = "degraded"
        db.commit()
        return {
            "success": False,
            "message": f"Sync completed with warning: {str(e)}",
            "last_synced": account.last_synced.isoformat()
        }

@router.delete("/{account_id}")
def delete_aws_account(account_id: str, db: Session = Depends(get_db)):
    """Disconnect and remove a registered AWS account. The Synthesis demo lab is protected."""
    target_id = "synthesis-demo" if account_id == "synthesis-lab-01" else account_id
    clean_id = target_id.replace("acc_", "")
    account = (
        db.query(AWSAccount)
        .filter(
            (AWSAccount.account_id == target_id)
            | (AWSAccount.id == (int(clean_id) if clean_id.isdigit() else -1))
        )
        .first()
    )

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AWS Account not found.")

    if account.is_demo or account.account_id == "synthesis-demo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The CloudSense Demo Lab (Synthesis) is protected and cannot be deleted."
        )

    db.delete(account)
    db.commit()
    return {"success": True, "message": f"AWS Account {account.account_id} disconnected successfully."}
