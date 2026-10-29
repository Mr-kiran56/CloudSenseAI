import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...db.session import get_db
from ...db.models import AWSAccount, User
from ...db.schemas import AWSAccountCreate, AWSAccountTestRequest
from ...aws.collector import AWSDataCollector
from ...aws.sync_pipeline import sync_live_aws_account
from ...core.secrets import encrypt_secret
from ...aws.credentials import collector_for_account, is_placeholder_role
from ..deps import get_current_user, is_demo_account_id, DEMO_ACCOUNT_IDS

logger = logging.getLogger("cloudsense.api.accounts")
router = APIRouter(prefix="/cloud-accounts", tags=["Cloud Accounts"])


def format_account(acc: AWSAccount) -> Dict[str, Any]:
    acc_id_str = f"acc_{acc.id}" if not acc.is_demo else "synthesis-lab-01"
    last_sync_str = (
        "Research lab models active"
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
        "hasCredentials": bool(acc.role_arn or acc.access_key_id),
    }


def _find_account(account_id: str, db: Session) -> Optional[AWSAccount]:
    target_id = "synthesis-demo" if account_id in DEMO_ACCOUNT_IDS else account_id
    clean_id = target_id.replace("acc_", "")
    return (
        db.query(AWSAccount)
        .filter(
            (AWSAccount.account_id == target_id)
            | (AWSAccount.id == (int(clean_id) if clean_id.isdigit() else -1))
        )
        .first()
    )


def _assert_owner(account: AWSAccount, user: User) -> None:
    if account.is_demo or user.role == "admin":
        return
    if account.user_id == user.id or (account.user_email and account.user_email.lower() == user.email.lower()):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this AWS account.")


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_cloud_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(AWSAccount).filter(
        (AWSAccount.user_id == current_user.id)
        | (AWSAccount.user_email == current_user.email)
        | (AWSAccount.is_demo == True)
    )
    if current_user.role == "admin":
        query = db.query(AWSAccount)

    accounts = query.order_by(AWSAccount.is_demo.asc(), AWSAccount.id.desc()).all()

    demo_found = any(a.is_demo or a.account_id == "synthesis-demo" for a in accounts)
    if not demo_found:
        demo_account = AWSAccount(
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
        db.add(demo_account)
        db.commit()
        db.refresh(demo_account)
        accounts.append(demo_account)

    sorted_accounts = sorted(accounts, key=lambda a: (1 if a.is_demo else 0, -a.id))
    return [format_account(acc) for acc in sorted_accounts]


@router.post("/test-connection")
def test_aws_connection(
    req: AWSAccountTestRequest,
    current_user: User = Depends(get_current_user),
):
    collector = AWSDataCollector(
        region_name=req.region or "us-east-1",
        role_arn=None if is_placeholder_role(req.role_arn) else req.role_arn,
        access_key_id=req.access_key_id,
        secret_access_key=req.secret_access_key,
        external_id=req.external_id,
    )
    return collector.test_connection()


@router.post("/connect-environment")
def connect_environment_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collector = AWSDataCollector(region_name="us-east-1")
    identity = collector.test_connection()
    if not identity.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=identity.get("error") or "No valid AWS credentials in the server environment.",
        )
    account_id = identity["account_id"]
    existing = db.query(AWSAccount).filter(AWSAccount.account_id == account_id).first()
    if existing:
        _assert_owner(existing, current_user)
        existing.user_id = current_user.id
        existing.user_email = current_user.email
        existing.status = "connected"
        db.commit()
        try:
            sync_live_aws_account(existing, db)
        except Exception as exc:
            logger.error("Environment account resync failed: %s", exc)
        return format_account(existing)

    new_account = AWSAccount(
        user_id=current_user.id,
        user_email=current_user.email,
        account_id=account_id,
        name=f"AWS {account_id}",
        alias=f"aws-{account_id}",
        env="production",
        region="us-east-1",
        role_arn=None,
        status="connected",
        monthly_spend=0.0,
        resource_count=0,
        is_demo=False,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    try:
        sync_live_aws_account(new_account, db)
        db.refresh(new_account)
    except Exception as exc:
        logger.error("Initial environment discovery failed: %s", exc)
    return format_account(new_account)


@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def connect_aws_account(
    req: AWSAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(AWSAccount).filter(AWSAccount.account_id == req.account_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AWS Account ID {req.account_id} is already connected.",
        )

    role_arn = None if is_placeholder_role(req.role_arn) else req.role_arn
    verified_arn = role_arn
    connection_status = "connected"
    if req.test_connection:
        collector = AWSDataCollector(
            region_name=req.region or "us-east-1",
            role_arn=role_arn,
            access_key_id=req.access_key_id,
            secret_access_key=req.secret_access_key,
            external_id=req.external_id,
        )
        test_res = collector.test_connection()
        if not test_res.get("success"):
            logger.warning("AWS connection test warning: %s", test_res.get("error"))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=test_res.get("error") or "AWS connection test failed.",
            )
        verified_arn = test_res.get("arn", req.role_arn)
        if test_res.get("account_id") and test_res.get("account_id") != req.account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Credentials belong to AWS account {test_res.get('account_id')}, not {req.account_id}.",
            )

    new_account = AWSAccount(
        user_id=current_user.id,
        user_email=current_user.email,
        account_id=req.account_id,
        name=req.name,
        alias=req.alias or req.name.lower().replace(" ", "-"),
        env=req.env or "production",
        region=req.region or "us-east-1",
        role_arn=verified_arn,
        access_key_id=encrypt_secret(req.access_key_id),
        secret_access_key=encrypt_secret(req.secret_access_key),
        external_id=req.external_id,
        status=connection_status,
        monthly_spend=0.0,
        resource_count=0,
        is_demo=False,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    try:
        if req.role_arn or (req.access_key_id and req.secret_access_key):
            sync_live_aws_account(new_account, db)
    except Exception as e:
        logger.error("Initial discovery error for account %s: %s", req.account_id, e)

    return format_account(new_account)


@router.post("/{account_id}/sync")
def sync_aws_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _find_account(account_id, db)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AWS Account not found.")
    _assert_owner(account, current_user)

    if account.is_demo or is_demo_account_id(account.account_id):
        account.last_synced = datetime.datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "message": "Research lab datasets and trained models are already loaded.",
            "last_synced": account.last_synced.isoformat(),
            "resources": account.resource_count,
            "monthly_spend": account.monthly_spend,
        }

    try:
        return sync_live_aws_account(account, db)
    except Exception as e:
        logger.error("Failed live sync for account %s: %s", account.account_id, e)
        account.status = "degraded"
        db.commit()
        return {
            "success": False,
            "message": "Sync could not complete. Check IAM permissions for Cost Explorer, EC2, and CloudWatch.",
            "last_synced": account.last_synced.isoformat() if account.last_synced else None,
        }


@router.delete("/{account_id}")
def delete_aws_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _find_account(account_id, db)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AWS Account not found.")
    _assert_owner(account, current_user)

    if account.is_demo or account.account_id == "synthesis-demo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The research lab account is shared and cannot be deleted.",
        )

    db.delete(account)
    db.commit()
    return {"success": True, "message": f"AWS Account {account.account_id} disconnected successfully."}
