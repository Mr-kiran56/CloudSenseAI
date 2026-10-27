from __future__ import annotations
def get_session(profile: str | None = None, region: str | None = None, role_arn: str | None = None):
    """Create a boto3 Session. Prefer a READ-ONLY IAM role/profile. Credentials are never stored in code."""
    import boto3
    s = boto3.Session(profile_name=profile, region_name=region)
    if role_arn:
        c = s.client("sts").assume_role(RoleArn=role_arn, RoleSessionName="cloudsense-readonly")["Credentials"]
        s = boto3.Session(aws_access_key_id=c["AccessKeyId"], aws_secret_access_key=c["SecretAccessKey"], aws_session_token=c["SessionToken"], region_name=region)
    return s
