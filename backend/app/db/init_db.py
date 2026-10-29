from sqlalchemy.orm import Session

from .session import engine, Base, SessionLocal
from .migrate_schema import migrate
from .seed_research import seed_research_lab
from .models import User


def init_db():
    Base.metadata.create_all(bind=engine)
    migrate()
    db: Session = SessionLocal()
    try:
        legacy_users = db.query(User).filter(
            User.email.in_(["analyst@cloudsense.ai", "engineer@cloudsense.ai"])
        ).all()
        if legacy_users:
            for user in legacy_users:
                db.delete(user)
            db.commit()
        seed_research_lab(db)
    except Exception as exc:
        db.rollback()
        print("Database initialization notice:", exc)
    finally:
        db.close()
