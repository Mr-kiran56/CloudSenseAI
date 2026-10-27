import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ...db.session import get_db
from ...db.models import DailyCost, CloudResource
from ...db.schemas import CostBreakdownItem, DailyCostPoint

router = APIRouter(prefix="/cost", tags=["Costs"])

DEFAULT_SYNTHESIS_BREAKDOWN = [
    {
        "name": "Amazon Elastic Compute Cloud (EC2)",
        "service": "Amazon Elastic Compute Cloud (EC2)",
        "category": "Compute",
        "cost": 6420.00,
        "percentage": 44.96,
        "trend": "up",
        "changePercent": 6.4
    },
    {
        "name": "Amazon Relational Database Service (RDS)",
        "service": "Amazon Relational Database Service (RDS)",
        "category": "Database",
        "cost": 3150.00,
        "percentage": 22.06,
        "trend": "up",
        "changePercent": 2.1
    },
    {
        "name": "Amazon Simple Storage Service (S3)",
        "service": "Amazon Simple Storage Service (S3)",
        "category": "Storage",
        "cost": 1840.00,
        "percentage": 12.89,
        "trend": "down",
        "changePercent": -1.8
    },
    {
        "name": "AWS Lambda & Serverless",
        "service": "AWS Lambda & Serverless",
        "category": "Serverless",
        "cost": 1120.00,
        "percentage": 7.84,
        "trend": "up",
        "changePercent": 14.8
    },
    {
        "name": "AWS Data Transfer & NAT Gateway",
        "service": "AWS Data Transfer & NAT Gateway",
        "category": "Networking",
        "cost": 980.00,
        "percentage": 6.86,
        "trend": "up",
        "changePercent": 8.2
    },
    {
        "name": "Amazon DynamoDB",
        "service": "Amazon DynamoDB",
        "category": "Database",
        "cost": 480.00,
        "percentage": 3.36,
        "trend": "flat",
        "changePercent": 0.4
    },
    {
        "name": "Other Monitored AWS Services",
        "service": "Other Monitored AWS Services",
        "category": "Other",
        "cost": 290.00,
        "percentage": 2.03,
        "trend": "down",
        "changePercent": -4.2
    }
]

@router.get("/breakdown", response_model=List[CostBreakdownItem])
def get_cost_breakdown(account_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Service-level cost breakdown. Dynamically calculates for real AWS accounts if synced."""
    if account_id and account_id not in ["synthesis-demo", "synthesis-lab-01", "all"]:
        # Query DB for this real account
        results = (
            db.query(DailyCost.service, func.sum(DailyCost.cost_usd).label("total_cost"))
            .filter(DailyCost.account_id == account_id)
            .group_by(DailyCost.service)
            .order_by(func.sum(DailyCost.cost_usd).desc())
            .all()
        )
        if results:
            total_spend = sum(r[1] for r in results) or 1.0
            breakdown = []
            for service, cost in results:
                pct = round((cost / total_spend) * 100, 2)
                breakdown.append({
                    "name": service,
                    "service": service,
                    "category": "Compute" if "EC2" in service or "Compute" in service else "Other",
                    "cost": round(cost, 2),
                    "percentage": pct,
                    "trend": "flat",
                    "changePercent": 0.0
                })
            return breakdown

    return DEFAULT_SYNTHESIS_BREAKDOWN

@router.get("/daily", response_model=List[DailyCostPoint])
def get_daily_costs(account_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Return historical daily costs for selected account or synthesis lab."""
    query = db.query(DailyCost)
    if account_id and account_id not in ["synthesis-demo", "synthesis-lab-01", "all"]:
        query = query.filter(DailyCost.account_id == account_id)

    records = query.order_by(DailyCost.date.desc()).limit(30).all()
    if records:
        return [
            DailyCostPoint(date=r.date, cost=r.cost_usd, service=r.service)
            for r in reversed(records)
        ]

    # Synthesis daily cost baseline
    today = datetime.date.today()
    return [
        DailyCostPoint(
            date=(today - datetime.timedelta(days=i)).strftime("%Y-%m-%d"),
            cost=round(440.0 + (i % 7) * 12.5, 2)
        )
        for i in range(30, 0, -1)
    ]
