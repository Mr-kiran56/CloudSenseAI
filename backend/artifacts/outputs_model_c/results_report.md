# Model C results: Isolation Forest anomaly + DoW detection
*Spec IsolationForest parameters {'n_estimators': 200, 'contamination': 0.01, 'max_samples': 'auto', 'random_state': 42}. Synthetic benchmark with a real-trace replay (unless replaced). Score is NOT a probability; alerts are DoW candidates, never confirmed attacks.*

## Setup
Chronological 60/20/20 split; fit on train only; threshold on validation only (15.0 false-alert windows/day budget, max F1); test used once. Test anomaly share 8.3% (train 0.67%).

## Test: any anomaly
                 precision  recall     F1  AUPRC  prevalence  AUROC
model                                                              
IF_spec_raw          0.261   0.277  0.269  0.269       0.083  0.777
IF_spec_resid        0.901   0.191  0.315  0.404       0.083  0.785
IF_core_resid        0.431   0.321  0.368  0.436       0.083  0.818
IF_ext_group         0.731   0.481  0.581  0.688       0.083  0.921
BL_zscore_rule       0.876   0.791  0.831  0.824       0.083  0.944
HYBRID_IF_zrule      0.876   0.791  0.831  0.825       0.083  0.946
BL_OneClassSVM       0.616   0.505  0.555  0.610       0.083  0.905
BL_LOF               0.429   0.765  0.550  0.635       0.083  0.921

## Test: DoW vs normal
                 precision  recall     F1  AUPRC  prevalence
model                                                       
IF_spec_raw          0.261   0.458  0.332  0.322       0.052
IF_spec_resid        0.901   0.315  0.467  0.529       0.052
IF_core_resid        0.429   0.527  0.473  0.570       0.052
IF_ext_group         0.661   0.569  0.612  0.771       0.052
BL_zscore_rule       0.838   0.954  0.892  0.912       0.052
HYBRID_IF_zrule      0.838   0.954  0.892  0.913       0.052
BL_OneClassSVM       0.615   0.831  0.707  0.766       0.052
BL_LOF               0.350   0.908  0.505  0.743       0.052

## Test: REAL-trace replay (dow_confirmed) vs normal
                 precision  recall     F1  AUPRC  prevalence
model                                                       
IF_spec_raw          0.006   0.027  0.010  0.030       0.015
IF_spec_resid        0.000   0.000  0.000  0.029       0.015
IF_core_resid        0.011   0.027  0.016  0.039       0.015
IF_ext_group         0.116   0.135  0.125  0.162       0.015
BL_zscore_rule       0.607   1.000  0.755  0.651       0.015
HYBRID_IF_zrule      0.607   1.000  0.755  0.651       0.015
BL_OneClassSVM       0.354   1.000  0.523  0.552       0.015
BL_LOF               0.145   1.000  0.253  0.979       0.015

## Incident level (test)
                 incident_recall  median_delay_min  false_alert_windows_per_day
model                                                                          
BL_LOF                     0.833               0.0                       24.333
BL_OneClassSVM             0.667               0.0                        7.500
BL_zscore_rule             0.917               0.0                        2.667
HYBRID_IF_zrule            0.917               0.0                        2.667
IF_core_resid              0.500               2.5                       10.111
IF_ext_group               0.833               0.0                        4.222
IF_spec_raw                0.417               0.0                       18.722
IF_spec_resid              0.333              15.0                        0.500

## Honest findings (computed from this run)
- Best Isolation-Forest variant AUPRC 0.688 (IF_ext_group) vs best baseline 0.824 (BL_zscore_rule); deployed detector `HYBRID_IF_zrule` AUPRC 0.825 (prevalence 0.083). A simple robust z-score rule beats the plain Isolation Forest on this synthetic data (injected anomalies are large single-feature deviations); the hybrid keeps the forest as the learned component and adds the rule as a safeguard.
- Core-only (CloudWatch metrics) vs extended (+ access-log features) detector, test AUPRC any-anomaly: 0.646 vs 0.825: log-derived IP-diversity features matter for separating DoW from flash crowds.
- Calendar ablation, promo-flash-crowd FPR: without 0.61 vs with 0.68.
- Unlabelled mode: threshold from an alert budget (12.0/day), no accuracy can be measured without labels.

## Real-data dispersion
real Borg CPU log-residual spread 2.88 vs synthetic 0.077; share |robust z|>3.5: real 0.0% vs synthetic 0.8%. Dispersion profiles differ strongly -> thresholds tuned on synthetic data are NOT transferable; recalibrate on your own account.

## Limitations
Synthetic telemetry; 1-3 incidents per type per split; prevalence in val/test higher than real operations; cost per window is estimated on real AWS data; thresholds must be recalibrated on your account.
