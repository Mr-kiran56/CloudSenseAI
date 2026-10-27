# Model B results: XGBoost unit economics
*Spec starting parameters tried first; Optuna-tuned parameters compared on validation; deployed: **xgb_spec_params** (144 trees, params {'max_depth': 6, 'learning_rate': 0.05, 'subsample': 0.8, 'colsample_bytree': 0.8, 'objective': 'reg:squarederror', 'random_state': 42}). Data: 2024-01-01 to 2026-09-30, 8 services (synthetic benchmark unless replaced).*
Target: next-day cost per API request (reported per 1,000 requests). Split: train <= 2025-12-02, val <= 2026-05-02, test after (used once).

## Test results
                           MAE     RMSE       R2     MAPE    sMAPE
model                                                             
naive_today            0.00117  0.00228  0.98805  4.73861  4.72655
naive_same_weekday     0.00193  0.00416  0.96007  6.86333  6.76148
linear_regression      0.00144  0.00234  0.98741  7.38457  7.58372
ridge                  0.00143  0.00236  0.98714  7.17482  7.31650
random_forest          0.00105  0.00174  0.99302  4.97348  4.84387
lightgbm               0.00105  0.00175  0.99295  5.14335  5.01376
xgb_spec_params        0.00100  0.00162  0.99392  4.91233  4.78644
xgb_tuned              0.00103  0.00162  0.99393  5.51172  5.33403
xgb_tuned_per_service  0.00154  0.00206  0.99021  9.33865  8.72183
xgb_final_refit        0.00095  0.00166  0.99365  4.56854  4.45713

## MAE improvement of final XGBoost over each baseline [mean, 95% CI]
                        mean        lo        hi
naive_today         0.000218  0.000113  0.000328
naive_same_weekday  0.000976  0.000821  0.001137
linear_regression   0.000486  0.000395  0.000574
ridge               0.000472  0.000375  0.000561
random_forest       0.000095  0.000048  0.000141
lightgbm            0.000095  0.000046  0.000142

Lowest test MAPE: xgb_final_refit. R2 leakage guard (<0.999) passed.

## Secondary targets
{'cost_per_active_user': {'xgb_MAE': 0.021, 'naive_MAE': 0.02022, 'excluded_rows': 0}, 'cost_per_transaction': {'xgb_MAE': 9e-05, 'naive_MAE': 0.0001, 'excluded_rows': 0}}

## Explainability and savings
SHAP gives drivers of the change vs each service's recent norm, a risk level and a recommended next investigation. SHAP does NOT establish savings; savings come from `cloudsense/savings.py` with explicit assumptions and ranges.
## Limitations
Synthetic data unless replaced; MAPE can favour naive baselines; per-service differences; one test period.
