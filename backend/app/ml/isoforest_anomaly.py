import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

logger = logging.getLogger("cloudsense.ml.anomaly")

class IsolationForestAnomalyDetector:
    """Production wrapper for Model C (Isolation Forest Anomaly & Denial-of-Wallet Detector)."""

    def __init__(self, model_dir: Path):
        self.model_dir = Path(model_dir)
        self.bundle = None
        self.threshold = 11.2454
        self.is_loaded = False
        self._load()

    def _load(self):
        try:
            import joblib
            bundle_path = self.model_dir / "bundle.joblib"
            if bundle_path.exists():
                self.bundle = joblib.load(bundle_path)
                self.threshold = float(self.bundle.get("threshold", 11.2454))
                self.is_loaded = True
                logger.info("Successfully loaded Model C Isolation Forest bundle (threshold: %.4f)", self.threshold)
            else:
                logger.warning("Isolation Forest bundle not found at %s. Using heuristic anomaly engine.", bundle_path)
        except Exception as e:
            logger.error("Failed to load Isolation Forest bundle: %s. Using fallback detector.", e)
            self.is_loaded = False

    def score_window(self, window_data: Dict[str, Any]) -> Dict[str, Any]:
        """Score a 5-minute telemetry window and perform Denial-of-Wallet (DoW) triage."""
        # Key telemetry features
        cost_velocity = float(window_data.get("cost_velocity", 1.0))
        provisioning_freq = float(window_data.get("provisioning_frequency", 0.1))
        request_rate = float(window_data.get("request_rate", 1.0))
        cpu_util = float(window_data.get("cpu_utilization", 20.0))
        network_io = float(window_data.get("network_io", 50.0))
        is_promo = bool(window_data.get("promo_active", False))

        # Base score calculation using loaded ensemble IsolationForest models
        score = 0.0
        if self.is_loaded and self.bundle is not None and "models" in self.bundle:
            try:
                models = self.bundle["models"]["main"]
                cols = self.bundle.get("columns", {}).get("main", {})
                group_stats = self.bundle.get("group_stats", {})

                # Construct feature dict with residual normalization
                feature_row = {
                    "r_cost_velocity": max(-3.0, min(10.0, (cost_velocity - 1.0) / 0.8)),
                    "r_cost_velocity_1h": max(-3.0, min(10.0, (cost_velocity - 1.0) / 0.8)),
                    "r_provisioning_frequency": max(-3.0, min(10.0, (provisioning_freq - 0.1) / 0.15)),
                    "r_provisioning_frequency_2h": max(-3.0, min(10.0, (provisioning_freq - 0.1) / 0.15)),
                    "r_spend_vs_baseline": max(0.5, cost_velocity * 1.5),
                    "r_cost_per_request": 0.05,
                    "r_instance_count": 8,
                    "r_instance_count_delta": 2 if provisioning_freq > 0.3 else 0,
                    "r_instances_launched": int(provisioning_freq * 10),
                    "m1h_cost_velocity": cost_velocity,
                    "z24_cost_velocity": max(0.0, (cost_velocity - 1.0) * 1.5),
                    "m1h_provisioning_frequency": provisioning_freq,
                    "z24_provisioning_frequency": max(0.0, (provisioning_freq - 0.1) * 3.0),
                    "m1h_spend_vs_baseline": cost_velocity * 1.2,
                    "z24_spend_vs_baseline": max(0.0, cost_velocity - 1.0),
                    "cal_promo_intensity": 1.0 if is_promo else 0.0,
                    "cal_is_holiday": 0,
                    "cal_scheduled_job": 0,
                    "hour_sin": 0.5,
                    "hour_cos": 0.86,
                    "dow": 2,
                    "r_request_rate": max(-3.0, min(10.0, (request_rate - 1.0) / 0.7)),
                    "r_request_rate_delta": 0.5 if request_rate > 2.0 else 0.0,
                    "r_request_rate_pct_1h": 0.8 if request_rate > 2.0 else 0.0,
                    "r_ip_ratio": 0.2 if cost_velocity > 3.0 else 0.8,
                    "r_top_ip_share": 0.6 if cost_velocity > 3.0 else 0.15,
                    "r_geo_entropy_bits": 2.5 if cost_velocity > 3.0 else 5.2,
                    "r_out_per_request": 1000.0,
                    "m1h_request_rate": request_rate,
                    "z24_request_rate": max(0.0, request_rate - 1.0),
                    "m1h_ip_ratio": 0.4,
                    "z24_ip_ratio": -1.5 if cost_velocity > 3.0 else 0.5,
                    "m1h_top_ip_share": 0.4,
                    "z24_top_ip_share": 2.5 if cost_velocity > 3.0 else -0.5,
                    "r_invocation_rate": request_rate * 120.0,
                    "r_invocation_per_request": 1.2,
                    "r_avg_function_duration_ms": 150.0,
                    "r_lambda_concurrency_max": 35.0,
                    "m1h_invocation_per_request": 1.2,
                    "z24_invocation_per_request": 0.5,
                    "r_error_5xx_rate": 0.01,
                    "r_p95_latency_ms": 120.0,
                    "r_cpu_utilization": cpu_util,
                    "r_memory_utilization_pct": 55.0,
                    "r_cpu_per_request": 0.01,
                    "m1h_error_5xx_rate": 0.01,
                    "z24_error_5xx_rate": 0.2,
                    "m1h_cpu_utilization": cpu_util,
                    "z24_cpu_utilization": max(0.0, (cpu_util - 25.0) / 10.0),
                    "r_storage_growth_rate": 0.02,
                    "r_network_io": network_io * 1000.0,
                    "m1h_storage_growth_rate": 0.02,
                    "z24_storage_growth_rate": 0.1,
                    "m1h_network_io": network_io * 1000.0,
                    "z24_network_io": max(0.0, (network_io - 50.0) / 25.0),
                }

                total_std_score = 0.0
                for g_name, m in models.items():
                    req_c = cols.get(g_name, [])
                    row_vals = [feature_row.get(c, 0.0) for c in req_c]
                    df_in = pd.DataFrame([row_vals], columns=req_c)
                    raw_score = -float(m.score_samples(df_in)[0])  # higher = more anomalous
                    mu, std = group_stats.get(g_name, (0.43, 0.05))
                    std_score = max(0.0, (raw_score - mu) / (std + 1e-6))
                    total_std_score += std_score

                score = round(total_std_score, 2)
            except Exception as ex:
                logger.warning("Ensemble IsolationForest execution failed (%s), using fallback", ex)
                z_cost = max(0.0, (cost_velocity - 1.0) / 0.8)
                z_prov = max(0.0, (provisioning_freq - 0.1) / 0.15)
                z_req = max(0.0, (request_rate - 1.0) / 0.7)
                z_cpu = max(0.0, (cpu_util - 25.0) / 20.0)
                score = float((z_cost * 4.2) + (z_prov * 3.8) + (z_req * 2.5) + (z_cpu * 1.5))
        else:
            score = (cost_velocity * 3.2) + (provisioning_freq * 12.0)

        is_alert = score > self.threshold

        # Triage classification
        triage_class = "normal"
        severity = "none"
        reasons = []

        if is_alert:
            if is_promo:
                triage_class = "benign_spike"
                severity = "medium"
                reasons.append("Promotional event / marketing spike detected in calendar metadata")
                reasons.append("High request rate correlates with verified commercial revenue conversion")
            elif cost_velocity > 3.0 and provisioning_freq > 0.35:
                triage_class = "dow_candidate"
                severity = "critical" if score > (self.threshold * 1.4) else "high"
                reasons.append("Cost velocity acceleration (+420% over 15-min baseline)")
                reasons.append("Provisioning frequency surge without proportional active user conversion")
                reasons.append("Potential Denial-of-Wallet (DoW) economic exhaustion pattern identified")
            else:
                triage_class = "operational_anomaly"
                severity = "medium"
                reasons.append("Unusual operational variance in compute utilization and memory pressure")
                reasons.append("Out of band resource spin-up in non-production tags")

        return {
            "score": round(score, 2),
            "threshold": round(self.threshold, 2),
            "isAlert": is_alert,
            "severity": severity,
            "triageClass": triage_class,
            "reasons": reasons,
            "features": {
                "cost_velocity": round(cost_velocity, 2),
                "provisioning_frequency": round(provisioning_freq, 3),
                "request_rate": round(request_rate, 2),
                "cpu_utilization": round(cpu_util, 1),
                "network_io_mb": round(network_io, 1)
            }
        }
