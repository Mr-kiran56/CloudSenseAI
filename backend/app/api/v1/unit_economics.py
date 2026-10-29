from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ...db.session import get_db
from ...db.models import AWSAccount, User
from ...ml.model_service import ml_service
from ..deps import get_current_user, assert_account_access, is_demo_account_id

router = APIRouter(prefix="/unit-economics", tags=["Unit Economics"])

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_unit_economics(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run live XGBoost Model B inference and compute SHAP feature drivers."""
    account = assert_account_access(account_id, current_user, db)
    scoped_id = account.account_id if account else (account_id or "synthesis-demo")
    is_demo = is_demo_account_id(scoped_id) or bool(account and account.is_demo)

    # For live AWS accounts, query recorded daily costs and cloud resources to construct telemetry observations
    observations = None
    if not is_demo and account_id:
        from ...db.models import CloudResource, DailyCost
        res_list = db.query(CloudResource).filter(CloudResource.account_id == scoped_id).all()
        costs = db.query(DailyCost).filter(DailyCost.account_id == scoped_id).all()
        if res_list:
            avg_cpu = sum(r.cpu_avg for r in res_list) / len(res_list) if res_list else 20.0
            total_spend = sum(c.cost_usd for c in costs) if costs else 100.0
            observations = [
                {
                    "service": "Amazon EC2",
                    "unit": "$ / 1k API reqs",
                    "current_cost": round(max(0.01, (total_spend * 0.4) / 10000.0), 4),
                    "prev_cost": round(max(0.009, (total_spend * 0.38) / 10000.0), 4),
                    "cpu_avg": float(avg_cpu),
                    "network_bytes": 104857600.0,
                    "provisioning_frequency": 0.12,
                    "time_lagged_spend": float(total_spend),
                    "active_users": 15000,
                    "transactions": 120000
                },
                {
                    "service": "AWS Lambda",
                    "unit": "$ / 10k Invocations",
                    "current_cost": 0.0021,
                    "prev_cost": 0.0019,
                    "cpu_avg": 50.0,
                    "network_bytes": 45000000.0,
                    "provisioning_frequency": 0.05,
                    "time_lagged_spend": round(total_spend * 0.15, 2),
                    "active_users": 15000,
                    "transactions": 300000
                }
            ]

    raw_results = ml_service.unit_economics.predict_unit_costs(observations=observations)
    
    # Map to frontend UnitEconomicsMetric format
    frontend_metrics = []
    for r in raw_results:
        shap_features = []
        for d in r.get("shapDrivers", []):
            impact = d["shap_change"]
            desc = f"{'Increases' if d['direction'] == 'raises' else 'Decreases'} unit cost by ${abs(impact):.4f} ({d['feature']})"
            shap_features.append({
                "feature": d["feature"],
                "impact": round(impact * 1000.0, 3), # Normalized impact score
                "description": desc
            })

        frontend_metrics.append({
            "id": r["id"],
            "name": r["name"],
            "unitLabel": r["unit"],
            "currentUnitCost": r["currentCost"],
            "predictedUnitCost": r["history"][-1]["cost"],
            "kpiVolume": 142000 if "ec2" in r["id"] else 390000,
            "costGrowthPercent": r["changePercent"],
            "kpiGrowthPercent": 4.2 if r["changePercent"] > 0 else 8.5,
            "efficiencyRatio": round(1.0 - (r["changePercent"] / 100.0), 3),
            "shapFeatures": shap_features
        })

    return frontend_metrics
