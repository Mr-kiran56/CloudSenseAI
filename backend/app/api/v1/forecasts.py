import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Optional

from ...db.session import get_db
from ...db.models import DailyCost, User
from ...ml.model_service import ml_service
from ..deps import get_current_user, assert_account_access, is_demo_account_id

router = APIRouter(prefix="/cost", tags=["Cost Forecasting"])


@router.get("/forecast")
def get_cost_forecast(
    horizon_days: int = 30,
    monthly_budget: float = 0.0,
    account_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    demo = is_demo_account_id(scoped_id) or bool(account and account.is_demo)

    daily_records = (
        db.query(DailyCost)
        .filter(DailyCost.account_id == scoped_id)
        .order_by(DailyCost.date.asc())
        .all()
    )
    date_totals: Dict[str, float] = {}
    for r in daily_records:
        date_totals[r.date] = date_totals.get(r.date, 0.0) + float(r.cost_usd)

    if monthly_budget <= 0 and date_totals:
        monthly_budget = sum(list(date_totals.values())[-30:])
    daily_budget = monthly_budget / 30.0 if monthly_budget else 0.0

    points = []
    if date_totals:
        sorted_dates = sorted(date_totals.keys())
        history = sorted_dates[-30:]
        for d in history:
            val = round(date_totals[d], 2)
            points.append({
                "date": d,
                "actualCost": val,
                "forecastCost": val,
                "confidenceUpper": round(val * 1.05, 2),
                "confidenceLower": round(val * 0.95, 2),
                "budgetLimit": round(daily_budget, 2),
            })
        recent_vals = [date_totals[d] for d in sorted_dates[-7:]]
        avg_daily = sum(recent_vals) / len(recent_vals) if recent_vals else 0.0
        last_date_obj = datetime.date.fromisoformat(sorted_dates[-1])
        for h in range(1, horizon_days + 1):
            next_d = (last_date_obj + datetime.timedelta(days=h)).isoformat()
            pred = round(avg_daily * (1.0 + (h * 0.0015)), 2)
            points.append({
                "date": next_d,
                "actualCost": None,
                "forecastCost": pred,
                "confidenceUpper": round(pred * 1.08, 2),
                "confidenceLower": round(pred * 0.92, 2),
                "budgetLimit": round(daily_budget, 2),
            })
        return points

    if demo and ml_service.forecaster.is_loaded:
        res = ml_service.forecaster.forecast(horizon_days=horizon_days, monthly_budget=monthly_budget or 14500.0)
        for p in res.get("points", []):
            points.append({
                "date": p["date"],
                "actualCost": None,
                "forecastCost": p["predicted"],
                "confidenceUpper": p["upperBound"],
                "confidenceLower": p["lowerBound"],
                "budgetLimit": round((monthly_budget or 14500.0) / 30.0, 2),
            })
        return points

    return []
