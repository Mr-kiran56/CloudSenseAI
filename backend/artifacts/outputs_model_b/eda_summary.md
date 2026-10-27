# EDA -> decisions
Unit cost differs by service -> service/instance_family/region/tag features and per-service comparison.
Cost = fixed + variable -> requests_per_instance, utilisation, lag features.
Month-to-date network volume drives a tier sawtooth -> mtd_network_bytes, tier1_share_used.
Weekend/month-end/promo effects -> next-day calendar features (known in advance).
CPU gaps imputed from TRAIN medians (flagged); transactions structurally zero for most services -> separate per-transaction model; zero denominators excluded.
