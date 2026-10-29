from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from ...db.session import get_db
from ...db.models import DailyCost, CloudResource, User
from ...db.schemas import CostBreakdownItem, DailyCostPoint
from ..deps import get_current_user, assert_account_access

router = APIRouter(prefix="/cost", tags=["Costs"])


def _category_for(service: str) -> str:
    s = service.lower()
    if "ec2" in s or "compute" in s or "lambda" in s:
        return "Compute"
    if "rds" in s or "dynamo" in s or "aurora" in s:
        return "Database"
    if "s3" in s or "ebs" in s or "glacier" in s:
        return "Storage"
    if "vpc" in s or "nat" in s or "transfer" in s or "cloudfront" in s:
        return "Networking"
    return "Other"


@router.get("/breakdown", response_model=List[CostBreakdownItem])
def get_cost_breakdown(
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")

    results = (
        db.query(DailyCost.service, func.sum(DailyCost.cost_usd).label("total_cost"))
        .filter(DailyCost.account_id == scoped_id)
        .group_by(DailyCost.service)
        .order_by(func.sum(DailyCost.cost_usd).desc())
        .all()
    )
    if not results:
        resources = db.query(CloudResource).filter(CloudResource.account_id == scoped_id).all()
        totals = {}
        for r in resources:
            totals[r.service] = totals.get(r.service, 0.0) + float(r.monthly_cost or 0.0)
        results = list(totals.items())

    breakdown = []
    total_spend = sum(float(r[1] or 0) for r in results) or 1.0
    for service, cost in results:
        cost = float(cost or 0)
        breakdown.append({
            "name": service,
            "service": service,
            "category": _category_for(service),
            "cost": round(cost, 2),
            "percentage": round((cost / total_spend) * 100, 2),
            "trend": "flat",
            "changePercent": 0.0,
        })
    return breakdown


@router.get("/daily", response_model=List[DailyCostPoint])
def get_daily_costs(
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    records = (
        db.query(DailyCost)
        .filter(DailyCost.account_id == scoped_id)
        .order_by(DailyCost.date.desc())
        .limit(90)
        .all()
    )
    return [
        DailyCostPoint(date=r.date, cost=r.cost_usd, service=r.service)
        for r in reversed(records)
    ]
