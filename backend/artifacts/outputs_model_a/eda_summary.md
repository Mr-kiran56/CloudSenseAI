# EDA -> decisions
Trend + weekly seasonality + month pattern + level shifts -> flexible changepoints, monthly seasonality, tuned priors.
Spikes inflate the series -> automatic outlier masking in training (works without incident labels).
Cost follows traffic but future traffic is unknown -> oracle vs forecast-regressor variants (oracle never deployed).
Missing days stay NaN. Non-stationary level -> Prophet trend model; SARIMA baseline differences the series.
