from sqlalchemy import inspect, text

from .session import engine


def migrate():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        if "cloud_resources" in tables:
            cr_cols = {c["name"] for c in inspector.get_columns("cloud_resources")}
            if "account_id" not in cr_cols:
                conn.execute(text("ALTER TABLE cloud_resources ADD COLUMN account_id VARCHAR(64) DEFAULT 'synthesis-demo'"))
            if "estimated_saving" not in cr_cols:
                conn.execute(text("ALTER TABLE cloud_resources ADD COLUMN estimated_saving FLOAT DEFAULT 0.0"))
            if "risk_level" not in cr_cols:
                conn.execute(text("ALTER TABLE cloud_resources ADD COLUMN risk_level VARCHAR(32) DEFAULT 'low'"))

        if "recommendations" in tables:
            rec_cols = {c["name"] for c in inspector.get_columns("recommendations")}
            if "account_id" not in rec_cols:
                conn.execute(text("ALTER TABLE recommendations ADD COLUMN account_id VARCHAR(64) DEFAULT 'synthesis-demo'"))

        if "approval_records" in tables:
            appr_cols = {c["name"] for c in inspector.get_columns("approval_records")}
            if "account_id" not in appr_cols:
                conn.execute(text("ALTER TABLE approval_records ADD COLUMN account_id VARCHAR(64) DEFAULT 'synthesis-demo'"))

        if "notifications" in tables:
            n_cols = {c["name"] for c in inspector.get_columns("notifications")}
            if "user_id" not in n_cols:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN user_id INTEGER"))
            if "account_id" not in n_cols:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN account_id VARCHAR(64)"))

        if "integrations" in tables:
            i_cols = {c["name"] for c in inspector.get_columns("integrations")}
            if "user_id" not in i_cols:
                conn.execute(text("ALTER TABLE integrations ADD COLUMN user_id INTEGER"))

        if "anomaly_incidents" in tables:
            a_cols = {c["name"] for c in inspector.get_columns("anomaly_incidents")}
            if "account_id" not in a_cols:
                conn.execute(text("ALTER TABLE anomaly_incidents ADD COLUMN account_id VARCHAR(64)"))


if __name__ == "__main__":
    migrate()
    print("Schema migration completed successfully.")
