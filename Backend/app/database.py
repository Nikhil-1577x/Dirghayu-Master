"""
database.py – PostgreSQL SQLAlchemy engine/session wiring.

IMPORTANT:
- Uses existing PostgreSQL schema only.
- Does NOT create/alter tables.
"""
from __future__ import annotations

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"sslmode": "require"},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Verify DB connectivity only.
    Schema is pre-created in PostgreSQL and must not be modified here.
    """
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("PostgreSQL connection verified")
