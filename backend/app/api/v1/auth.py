import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...db.models import User, AWSAccount
from ...db.schemas import UserLogin, UserRegister, Token, UserResponse
from ...core.security import verify_password, get_password_hash, create_access_token
from ...core.secrets import encrypt_secret
from ...aws.collector import AWSDataCollector
from ..deps import ALLOWED_ROLES, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _public_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at,
    }


@router.post("/login", response_model=Token)
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    clean_email = form_data.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    access_token = create_access_token(subject=user.email, role=user.role)
    return {"access_token": access_token, "token_type": "bearer", "user": _public_user(user)}


@router.post("/register", response_model=Token)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    clean_email = user_in.email.lower().strip()
    if len(user_in.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered. Please sign in to your existing account.",
        )

    requested_role = (user_in.role or "cloud_engineer").strip().lower()
    if requested_role not in ALLOWED_ROLES:
        requested_role = "cloud_engineer"
    user_count = db.query(User).count()
    if requested_role == "admin" and user_count > 0:
        requested_role = "cloud_engineer"

    user = User(
        email=clean_email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.name.strip(),
        role=requested_role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if user_in.aws_account_id:
        existing_acc = db.query(AWSAccount).filter(AWSAccount.account_id == user_in.aws_account_id.strip()).first()
        if existing_acc:
            if existing_acc.user_id and existing_acc.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="That AWS account is already connected to another workspace.",
                )
            existing_acc.user_id = user.id
            existing_acc.user_email = user.email
            db.commit()
        else:
            new_acc = AWSAccount(
                user_id=user.id,
                user_email=user.email,
                account_id=user_in.aws_account_id.strip(),
                name=user_in.aws_account_name or f"{user_in.name}'s AWS Account",
                alias=(user_in.aws_account_name or "aws-primary").lower().replace(" ", "-"),
                env=user_in.aws_env or "production",
                region=user_in.aws_region or "us-east-1",
                role_arn=user_in.aws_role_arn,
                access_key_id=encrypt_secret(user_in.aws_access_key_id),
                secret_access_key=encrypt_secret(user_in.aws_secret_access_key),
                external_id=user_in.aws_external_id,
                status="connected",
                monthly_spend=0.0,
                resource_count=0,
                is_demo=False,
                last_synced=datetime.datetime.utcnow(),
            )
            db.add(new_acc)
            db.commit()
            db.refresh(new_acc)
            try:
                if user_in.aws_role_arn or (user_in.aws_access_key_id and user_in.aws_secret_access_key):
                    collector = AWSDataCollector(
                        region_name=user_in.aws_region or "us-east-1",
                        role_arn=user_in.aws_role_arn,
                        access_key_id=user_in.aws_access_key_id,
                        secret_access_key=user_in.aws_secret_access_key,
                        external_id=user_in.aws_external_id,
                    )
                    res_list = collector.collect_resources()
                    new_acc.resource_count = len(res_list)
                    db.commit()
            except Exception:
                pass

    access_token = create_access_token(subject=user.email, role=user.role)
    return {"access_token": access_token, "token_type": "bearer", "user": _public_user(user)}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _public_user(current_user)
