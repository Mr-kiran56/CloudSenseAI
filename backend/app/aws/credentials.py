from typing import Optional

from ..core.secrets import decrypt_secret
from ..db.models import AWSAccount
from .collector import AWSDataCollector


def is_placeholder_role(role_arn: Optional[str]) -> bool:
    if not role_arn:
        return True
    return "123456789012" in role_arn or "synthesis-demo" in role_arn


def collector_for_account(account: AWSAccount) -> AWSDataCollector:
    role_arn = None if is_placeholder_role(account.role_arn) else account.role_arn
    return AWSDataCollector(
        region_name=account.region or "us-east-1",
        role_arn=role_arn,
        access_key_id=decrypt_secret(account.access_key_id),
        secret_access_key=decrypt_secret(account.secret_access_key),
        external_id=account.external_id,
    )
