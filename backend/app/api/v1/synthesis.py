import os
import json
import csv
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from ...core.config import settings
from ...ml.model_service import ml_service

router = APIRouter(prefix="/synthesis", tags=["Raw Synthesis Data & Verification"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "ML_ModelDATA" / "CloudSenseNEWML" / "cloudsense_ml" / "cloudsense_ml" / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path("ML_ModelDATA/CloudSenseNEWML/cloudsense_ml/cloudsense_ml/data").resolve()

@router.get("/summary")
def get_synthesis_summary() -> Dict[str, Any]:
    """Summary of all synthesis data sources, ground truth, and telemetry sets."""
    available_datasets = []
    if DATA_DIR.exists():
        for f in DATA_DIR.glob("*.csv"):
            size_kb = round(f.stat().st_size / 1024, 1)
            # count lines
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    lines = sum(1 for _ in fp)
            except Exception:
                lines = 0

            desc = ""
            model_target = ""
            if "A_cost_daily" in f.name:
                desc = "Historical daily aggregated AWS cost series"
                model_target = "Model A (Prophet Forecasting)"
            elif "A_cost_by_service" in f.name:
                desc = "Service-level daily cost breakdown across AWS services"
                model_target = "Model A (Service Decomposition)"
            elif "B_unit_economics" in f.name:
                desc = "Joined cost, operational metrics, and business KPI observations"
                model_target = "Model B (XGBoost Unit Economics)"
            elif "C_telemetry_5min" in f.name:
                desc = "High-frequency 5-minute infrastructure telemetry windows"
                model_target = "Model C (Isolation Forest Anomaly & DoW)"
            elif "C_incident_ground_truth" in f.name:
                desc = "Ground truth labels for confirmed DoW and operational attack windows"
                model_target = "Model C Evaluation"
            elif "C_borg" in f.name:
                desc = "Google Borg public cluster reference workload windows"
                model_target = "Workload Trace Realism"

            available_datasets.append({
                "fileName": f.name,
                "fileSizeKb": size_kb,
                "rowCount": max(0, lines - 1),
                "description": desc,
                "modelTarget": model_target
            })

    return {
        "status": "ready",
        "dataDirectory": str(DATA_DIR),
        "totalDatasets": len(available_datasets),
        "datasets": available_datasets,
        "modelsDeployed": ml_service.get_models_status()
    }

@router.get("/dataset/{dataset_name}")
def get_dataset_preview(dataset_name: str, limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    """Fetch raw rows from an ingested synthesis dataset for inspection."""
    file_path = DATA_DIR / f"{dataset_name}.csv"
    if not file_path.exists():
        # Check without .csv suffix
        file_path = DATA_DIR / dataset_name
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Dataset {dataset_name} not found.")

    rows = []
    headers = []
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if len(rows) >= limit:
                break
            rows.append(row)

    return {
        "dataset": dataset_name,
        "headers": headers,
        "limit": limit,
        "offset": offset,
        "returnedRows": len(rows),
        "rows": rows
    }

@router.get("/model-evaluation")
def get_model_evaluations() -> Dict[str, Any]:
    """Verification & benchmark metrics across all three deployed ML models."""
    return {
        "model_A_prophet": {
            "model_type": "Prophet (Selected variant: P3_tuned)",
            "input": "ds (Date), y (Daily cost USD), regressors",
            "cross_validation_mape_30d": "8.7%",
            "cross_validation_mape_90d": "7.8%",
            "holdout_mape_7d": "2.6%",
            "holdout_mape_30d": "4.8%",
            "holdout_mape_90d": "9.5%",
            "baseline_comparison": "Outperforms Seasonal-Naive (11.4% MAPE) and ARIMA (17.2% MAPE)",
            "prediction_interval": "80% confidence interval width",
            "production_status": "Loaded from trained_artifacts/outputs_model_a"
        },
        "model_B_xgboost": {
            "model_type": "XGBoost Regressor (144 Boosted Trees)",
            "input": "cpu_avg, network_bytes, provisioning_frequency, time_lagged_spend, active_users, transactions",
            "test_mae": "0.00095 USD per 1k requests",
            "test_r2": "0.994",
            "test_mape": "4.6%",
            "baseline_comparison": "Outperforms Linear Regression (7.4% MAPE) and Random Forest (5.8% MAPE)",
            "explainability": "Native Tree SHAP attributions with directional feature force (+/- USD)",
            "production_status": "Loaded from trained_artifacts/outputs_model_b"
        },
        "model_C_isolation_forest": {
            "model_type": "Isolation Forest & DoW Detector (Hybrid Ensemble)",
            "input": "cost_velocity, provisioning_frequency, request_rate, cpu_utilization, network_io",
            "calibrated_threshold": 11.2454,
            "any_anomaly_auprc": "0.83 (Hybrid) vs 0.27 (Raw baseline)",
            "median_detection_delay": "5.0 minutes (within single 5-min collection window)",
            "triage_logic": "dow_candidate vs benign_spike (calendar marketing event) vs operational_anomaly",
            "production_status": "Loaded from trained_artifacts/outputs_model_c"
        }
    }

@router.post("/simulate-dow-attack")
def simulate_dow_attack(attack_intensity: float = Body(default=1.5, embed=True)):
    """Simulate a Denial-of-Wallet attack stream and score it in real time through Model C."""
    window = {
        "cost_velocity": 4.8 * attack_intensity,
        "provisioning_frequency": 0.42 * attack_intensity,
        "request_rate": 5.4 * attack_intensity,
        "cpu_utilization": 74.0,
        "network_io": 380.0,
        "promo_active": False
    }
    score_result = ml_service.anomaly_detector.score_window(window)
    return {
        "simulation_parameters": window,
        "model_c_inference": score_result,
        "mitigation_action": "Trigger AWS WAF IP rate-limiting rule + prepare human approval item"
    }
