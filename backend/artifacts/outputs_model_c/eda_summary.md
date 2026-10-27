# EDA -> decisions
Strong daily cycle -> train-only seasonal residual features (deviation from time-of-day norm).
Benign look-alikes (flash crowds, nightly batch, rolling deploys) mimic attacks -> traffic-quality features (IP diversity) + calendar flags when available.
Anomaly share rises train->val->test -> report AUPRC with prevalence; tune threshold on validation only.
Residual features are correlated -> feature-group ensemble when extended columns exist.
Real Borg dispersion differs from synthetic -> recalibrate thresholds per environment.
