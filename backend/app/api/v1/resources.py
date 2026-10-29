import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...db.session import get_db
from ...db.models import CloudResource, User
from ..deps import get_current_user, assert_account_access

router = APIRouter(prefix="/resources", tags=["Cloud Resources"])


def _format_resource(r: CloudResource) -> Dict[str, Any]:
    tags = {}
    try:
        tags = json.loads(r.tags_json or "{}")
    except Exception:
        pass
    cpu = float(r.cpu_avg or 0.0)
    mem = float(r.memory_avg or 0.0)
    daily_cost = round(float(r.monthly_cost or 0.0) / 730.0, 4)
    return {
        "id": r.resource_id,
        "resourceId": r.resource_id,
        "name": r.name,
        "service": r.service.replace("Amazon ", "").replace("AWS ", ""),
        "region": r.region or "us-east-1",
        "environment": str(tags.get("Environment", "production")).lower(),
        "status": r.status or "healthy",
        "cpuUtilization": cpu,
        "memoryUtilization": mem,
        "networkIOMbs": round(float(r.network_in or 0.0) + float(r.network_out or 0.0), 1),
        "monthlyCost": float(r.monthly_cost or 0.0),
        "estimatedSaving": float(r.estimated_saving or 0.0),
        "riskLevel": r.risk_level or "low",
        "lastSeen": "Live inventory",
        "tags": tags,
        "metricsHistory": [
            {"timestamp": "08:00", "cpu": cpu, "memory": mem, "cost": daily_cost},
            {"timestamp": "12:00", "cpu": cpu, "memory": mem, "cost": daily_cost},
            {"timestamp": "16:00", "cpu": cpu, "memory": mem, "cost": daily_cost},
        ],
    }


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_resources(
    account_id: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    query = db.query(CloudResource).filter(CloudResource.account_id == scoped_id)
    if service and service.upper() != "ALL":
        query = query.filter(CloudResource.service.ilike(f"%{service}%"))
    if status and status.upper() != "ALL":
        query = query.filter(CloudResource.status == status.lower())
    if region and region.upper() != "ALL":
        query = query.filter(CloudResource.region == region)
    return [_format_resource(r) for r in query.all()]
