from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

database_url = settings.sqlalchemy_database_url
if database_url.startswith("sqlite"):
    connect_args: dict[str, object] = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": settings.database_connect_timeout_seconds}

engine = create_engine(
    database_url,
    connect_args=connect_args,
    future=True,
    pool_pre_ping=True,
    pool_recycle=settings.database_pool_recycle_seconds,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
