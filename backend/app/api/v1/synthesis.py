import os
import json
import csv
import uuid
import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from ...core.config import settings
from ...ml.model_service import ml_service
from ...db.session import get_db
from ...db.models import AnomalyIncident, Notification, AuditEvent
from .integrations import dispatch_notification_to_webhooks

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
def simulate_dow_attack(
    attack_intensity: float = Body(default=1.5, embed=True),
    db: Session = Depends(get_db)
):
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

    incident_id = f"inc_dow_{uuid.uuid4().hex[:6]}"
    is_alert = score_result.get("isAlert", True)
    triage_class = score_result.get("triageClass", "dow_candidate")
    anomaly_score = float(score_result.get("anomalyScore", 14.8))
    threshold = float(score_result.get("threshold", 11.2454))

    # Persist incident in database
    if is_alert:
        incident = AnomalyIncident(
            incident_id=incident_id,
            title=f"Denial-of-Wallet (DoW) Wave: {triage_class.replace('_', ' ').title()}",
            service="Lambda",
            resource_id="arn:aws:lambda:us-east-1:123456789012:function:checkout-payment-handler",
            score=anomaly_score,
            threshold=threshold,
            severity="critical",
            status="investigating",
            triage_class=triage_class,
            root_cause=f"High-frequency request surge ({window['request_rate']:.1f} req/s) with abnormal cost velocity (+{window['cost_velocity']*100:.0f}%) and 0% transaction conversion.",
            detected_at=datetime.datetime.utcnow(),
            evidence_json=json.dumps({"window": window, "score_result": score_result})
        )
        db.add(incident)

        # Persist notification
        notif = Notification(
            title=f"Critical: Denial-of-Wallet Wave Detected (Score: {anomaly_score:.2f})",
            message=f"Model C hybrid detector flagged abnormal cost velocity on Lambda checkout API. Recommended action: WAF rate-limiting policy.",
            severity="critical",
            category="dow",
            read=False,
            created_at=datetime.datetime.utcnow(),
            link="/anomalies-dow"
        )
        db.add(notif)

        # Persist audit event
        audit = AuditEvent(
            event_id=f"evt_dow_{uuid.uuid4().hex[:6]}",
            actor="Model C Ensemble (IsoForest + Rule Engine)",
            action="DOW_ANOMALY_TRIGGERED",
            target="arn:aws:lambda:us-east-1:123456789012:function:checkout-payment-handler",
            target_type="LAMBDA_FUNCTION",
            status="SUCCESS",
            details_json=json.dumps(score_result)
        )
        db.add(audit)
        db.commit()

        # Outbound notification dispatch
        dispatch_notification_to_webhooks(
            event_type="anomaly",
            title=f"ALERT: Denial-of-Wallet (DoW) Ingress Wave (Model C Score {anomaly_score:.2f})",
            description=f"Model C ensemble detected malicious cost velocity expansion on Lambda checkout-payment-handler. Anomaly score {anomaly_score:.2f} exceeded calibrated threshold {threshold:.2f}.",
            data={"incident_id": incident_id, "score": anomaly_score, "triage": triage_class}
        )

    return {
        "incident_id": incident_id,
        "simulation_parameters": window,
        "model_c_inference": score_result,
        "persisted_to_db": is_alert,
        "mitigation_action": "Trigger AWS WAF IP rate-limiting rule + prepare human approval item"
    }
