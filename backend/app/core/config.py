import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = "CloudSense AI Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "cloudsense-super-secret-jwt-key-2026-production-finops-token")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'cloudsense.db'}")
    
    # AWS / MCP Configuration
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ROLE_ARN: str = os.getenv("AWS_ROLE_ARN", "")
    REMEDIATION_ENABLED: bool = os.getenv("REMEDIATION_ENABLED", "false").lower() in ("true", "1", "yes")
    
    # ML Artifacts
    ARTIFACTS_DIR: Path = Path(os.getenv("ARTIFACTS_DIR", str(BASE_DIR / "artifacts")))
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
