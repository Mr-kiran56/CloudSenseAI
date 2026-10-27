from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import datetime
from ...db.session import get_db
from ...db.models import User, AWSAccount
from ...db.schemas import UserLogin, UserRegister, Token, UserResponse
from ...core.security import verify_password, get_password_hash, create_access_token, decode_access_token, oauth2_scheme
from ...aws.collector import AWSDataCollector

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        # Fallback to default admin for unauthenticated browser access if token omitted
        user = db.query(User).filter(User.email == "admin@cloudsense.ai").first()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials not provided."
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials."
        )

    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user

@router.post("/login", response_model=Token)
def login(form_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    
    access_token = create_access_token(subject=user.email, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at
        }
    }

@router.post("/register", response_model=Token)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")
    
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.name,
        role=user_in.role or "cloud_engineer",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Optional initial real AWS account registration during signup
    if user_in.aws_account_id:
        existing_acc = db.query(AWSAccount).filter(AWSAccount.account_id == user_in.aws_account_id).first()
        if not existing_acc:
            new_acc = AWSAccount(
                account_id=user_in.aws_account_id,
                name=user_in.aws_account_name or f"{user_in.name}'s AWS Account",
                alias=(user_in.aws_account_name or "aws-primary").lower().replace(" ", "-"),
                env=user_in.aws_env or "production",
                region=user_in.aws_region or "us-east-1",
                role_arn=user_in.aws_role_arn,
                access_key_id=user_in.aws_access_key_id,
                secret_access_key=user_in.aws_secret_access_key,
                external_id=user_in.aws_external_id,
                status="connected",
                monthly_spend=0.0,
                resource_count=0,
                is_demo=False,
                last_synced=datetime.datetime.utcnow()
            )
            db.add(new_acc)
            db.commit()
            db.refresh(new_acc)

            # Trigger non-blocking initial discovery if credentials provided
            try:
                if user_in.aws_role_arn or (user_in.aws_access_key_id and user_in.aws_secret_access_key):
                    collector = AWSDataCollector(
                        region_name=user_in.aws_region or "us-east-1",
                        role_arn=user_in.aws_role_arn,
                        access_key_id=user_in.aws_access_key_id,
                        secret_access_key=user_in.aws_secret_access_key,
                        external_id=user_in.aws_external_id
                    )
                    res_list = collector.collect_resources()
                    new_acc.resource_count = len(res_list)
                    db.commit()
            except Exception:
                pass

    access_token = create_access_token(subject=user.email, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at
        }
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at
    }
