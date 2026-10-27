from pathlib import Path
from ..core.config import settings
from .prophet_forecaster import ProphetForecaster
from .xgb_unit_economics import XGBoostUnitEconomics
from .isoforest_anomaly import IsolationForestAnomalyDetector
from .savings import (
    calculate_idle_instance_savings,
    calculate_rightsizing_savings,
    calculate_unattached_ebs_savings
)

class MLModelService:
    """Central registry and lifecycle manager for all three CloudSense ML models."""

    def __init__(self):
        artifacts_root = settings.ARTIFACTS_DIR
        
        # Paths to artifacts
        path_a = artifacts_root / "outputs_model_a" / "artifacts" / "model_registry" / "prophet_cost"
        path_b = artifacts_root / "outputs_model_b" / "artifacts" / "model_registry" / "xgb_unit_economics"
        path_c = artifacts_root / "outputs_model_c" / "artifacts" / "model_registry" / "isoforest_extended"

        self.forecaster = ProphetForecaster(path_a)
        self.unit_economics = XGBoostUnitEconomics(path_b)
        self.anomaly_detector = IsolationForestAnomalyDetector(path_c)

    def get_models_status(self):
        return {
            "model_a_prophet": {
                "name": "Prophet Cost Forecaster",
                "loaded": self.forecaster.is_loaded,
                "variant": "P3_tuned",
                "horizons": [7, 30, 90],
                "target": "Daily AWS expenditure (USD)"
            },
            "model_b_xgboost": {
                "name": "XGBoost Unit Economics & SHAP",
                "loaded": self.unit_economics.is_loaded,
                "trees": self.unit_economics.booster.num_boosted_rounds() if self.unit_economics.booster else 0,
                "target": "Cost per 1k API requests / active user"
            },
            "model_c_isolation_forest": {
                "name": "Isolation Forest & DoW Detector",
                "loaded": self.anomaly_detector.is_loaded,
                "threshold": self.anomaly_detector.threshold,
                "target": "5-minute telemetry anomaly score & DoW triage"
            }
        }

ml_service = MLModelService()
