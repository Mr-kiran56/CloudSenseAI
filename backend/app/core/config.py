import os
from pathlib import Path
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    load_dotenv(BASE_DIR / ".env")
    load_dotenv(BASE_DIR.parent / ".env")
except ImportError:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "CloudSense AI Platform")
    VERSION: str = os.getenv("VERSION", "1.0.0")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    BASE_DIR: Path = BASE_DIR

    SECRET_KEY: str = os.getenv("SECRET_KEY", "cloudsense-super-secret-jwt-key-2026-production-finops-token")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'cloudsense.db').as_posix()}")

    @property
    def RESOLVED_DATABASE_URL(self) -> str:
        raw = self.DATABASE_URL
        if "sqlite:///" in raw:
            path = raw.replace("sqlite:///", "", 1)
            if "./" in raw or ".\\" in raw or not Path(path).is_absolute():
                return f"sqlite:///{(BASE_DIR / 'cloudsense.db').as_posix()}"
        return raw

    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCOUNT_ID: str = os.getenv("AWS_ACCOUNT_ID", "658606186069")
    AWS_ROLE_ARN: str = os.getenv("AWS_ROLE_ARN", "arn:aws:iam::658606186069:role/CloudSenseFinOpsReadOnlyPolicy")
    AWS_EXTERNAL_ID: str = os.getenv("AWS_EXTERNAL_ID", "cloudsense-audit-token")
    REMEDIATION_ENABLED: bool = os.getenv("REMEDIATION_ENABLED", "false").lower() in ("true", "1", "yes")

    ARTIFACTS_DIR: Path = (
        BASE_DIR / "artifacts"
        if not Path(os.getenv("ARTIFACTS_DIR", "artifacts")).is_absolute()
        else Path(os.getenv("ARTIFACTS_DIR"))
    )

    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
if not settings.SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in the environment or .env file.")
