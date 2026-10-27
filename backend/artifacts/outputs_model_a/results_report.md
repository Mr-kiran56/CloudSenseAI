# Model A results: Prophet cost forecasting
*Spec parameters: linear growth, no daily seasonality, weekly when supported, yearly=auto, 80% interval, horizons 7/30/90. Data: 2024-01-01 to 2026-09-30 (1000 rows; synthetic benchmark unless you replaced it).*

## Validation design
Expanding-window rolling-origin CV (4 folds), selection on mean MAPE at 30 days, final hold-out = last 90 days evaluated ONCE. Missing dates: ['2024-03-09', '2025-01-17', '2025-08-30', '2026-02-02'] (kept as NaN).

## CV MAPE % by variant and horizon (P4 uses oracle future regressors: not deployable)
h                     7     30     90                                note
variant                                                                  
B_drift           13.60  11.30  11.23                                    
B_sarima          14.45  11.97  11.59                                    
B_snaive28        17.92  14.85  16.09                                    
B_snaive7         17.03  12.52  10.57                                    
P0_defaults       11.25  12.62  15.36                                    
P1_mask           12.38  10.64  11.13                                    
P2_mask_monthly   12.30  10.12  10.46                                    
P3_tuned          12.62   8.73   7.76                                    
P4_oracle_regs    11.14   8.61   8.17  ORACLE regressors - not deployable
P5_forecast_regs  13.91   9.66   8.90                                    
P6_per_service    12.66   8.81   7.91                                    

## Selected deployable model: P3_tuned  params: {'changepoint_prior_scale': 0.2, 'seasonality_prior_scale': 1.0, 'seasonality_mode': 'multiplicative', 'changepoint_range': 0.9}
Hold-out (trained only before the hold-out):
      MAPE     RMSE     MAE  coverage80
h7   2.590   14.968  10.534      71.429
h30  4.770   75.504  26.425      63.333
h90  9.544  126.623  61.854      45.556
MAPE < 5% reached on this single hold-out window: {7: True, 30: True, 90: False}
**Do not over-read this:** the hold-out is ONE 90-day window. Rolling-origin CV for the selected variant averages 8.7% MAPE at 30 days and 7.8% at 90 days over 4 folds. Report the CV figures as the expected accuracy and the hold-out as one confirmation.
Interval calibration: the nominal 80% intervals covered 71% / 63% / 46% of actual days at 7/30/90 days, i.e. they are too narrow, especially for long horizons (cost incidents and level shifts are not in the uncertainty model).

## Limitations
Hold-out may contain incidents; regressors must be forecast (adds error); few CV folds; synthetic data unless replaced.
