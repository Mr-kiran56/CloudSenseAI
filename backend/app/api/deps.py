from typing import Optional, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.security import decode_access_token, oauth2_scheme
from ..db.models import AWSAccount, User
from ..db.session import get_db

DEMO_ACCOUNT_IDS: Set[str] = {"synthesis-demo", "synthesis-lab-01", "acc_demo"}
ALLOWED_ROLES = {"admin", "finops_analyst", "cloud_engineer", "viewer"}


def is_demo_account_id(account_id: Optional[str]) -> bool:
    return bool(account_id) and account_id in DEMO_ACCOUNT_IDS


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )
    return user


def require_roles(*roles: str):
    allowed = set(roles)

    def _inner(user: User = Depends(get_current_user)) -> User:
        if user.role == "admin" or user.role in allowed:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")

    return _inner


def user_account_ids(user: User, db: Session) -> Set[str]:
    rows = db.query(AWSAccount).filter(
        (AWSAccount.user_id == user.id)
        | (AWSAccount.user_email == user.email)
        | (AWSAccount.is_demo == True)  # noqa: E712
    ).all()
    ids = {a.account_id for a in rows}
    ids.update(DEMO_ACCOUNT_IDS)
    return ids


def assert_account_access(
    account_id: Optional[str],
    user: User,
    db: Session,
) -> Optional[AWSAccount]:
    if not account_id or is_demo_account_id(account_id):
        return db.query(AWSAccount).filter(AWSAccount.account_id == "synthesis-demo").first()

    account = db.query(AWSAccount).filter(AWSAccount.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AWS account not found.")
    if user.role == "admin":
        return account
    if account.user_id == user.id or (
        account.user_email and account.user_email.lower() == user.email.lower()
    ):
        return account
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this AWS account.",
    )
