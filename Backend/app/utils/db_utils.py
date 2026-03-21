"""
db_utils.py – Reusable database helper functions.
"""
from __future__ import annotations
from contextlib import contextmanager
from typing import Any, Optional
from datetime import date, datetime, time

from sqlalchemy import text
from sqlalchemy.orm import Session
import logging

from app.database import SessionLocal

logger = logging.getLogger(__name__)


def _normalize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {k: _normalize_value(v) for k, v in row.items()}


def _transform_qmark_sql(sql: str, params: tuple[Any, ...]) -> tuple[str, dict[str, Any]]:
    """
    Convert legacy '?' placeholders to SQLAlchemy named binds.
    Example: '... WHERE id = ? AND a = ?' -> '... WHERE id = :p0 AND a = :p1'
    """
    if "?" not in sql:
        return sql, {}
    bind_params: dict[str, Any] = {}
    converted = sql
    for idx, value in enumerate(params):
        key = f"p{idx}"
        converted = converted.replace("?", f":{key}", 1)
        bind_params[key] = value
    return converted, bind_params


@contextmanager
def _session_scope(db: Optional[Session] = None):
    if db is not None:
        yield db, False
        return
    local_db = SessionLocal()
    try:
        yield local_db, True
    finally:
        local_db.close()


def fetchone(sql: str, params: tuple = (), db: Optional[Session] = None):
    with _session_scope(db) as (session, owns):
        stmt, bind_params = _transform_qmark_sql(sql, params)
        row = session.execute(text(stmt), bind_params).mappings().first()
        logger.debug("DB fetchone query=%s found=%s", stmt, row is not None)
        return _normalize_row(dict(row)) if row is not None else None


def fetchall(sql: str, params: tuple = (), db: Optional[Session] = None):
    with _session_scope(db) as (session, owns):
        stmt, bind_params = _transform_qmark_sql(sql, params)
        rows = session.execute(text(stmt), bind_params).mappings().all()
        logger.debug("DB fetchall query=%s rows=%d", stmt, len(rows))
        return [_normalize_row(dict(r)) for r in rows]


def execute(sql: str, params: tuple = (), db: Optional[Session] = None) -> int:
    """Execute a write statement. Returns lastrowid."""
    with _session_scope(db) as (session, owns):
        stmt, bind_params = _transform_qmark_sql(sql, params)
        result = session.execute(text(stmt), bind_params)
        inserted_id = None
        if result.returns_rows:
            maybe_row = result.first()
            if maybe_row is not None and len(maybe_row) > 0:
                inserted_id = maybe_row[0]
        session.commit()
        logger.info("DB execute query=%s rowcount=%s", stmt, result.rowcount)
        return int(inserted_id) if inserted_id is not None else 0


def executemany(sql: str, params_list: list[tuple], db: Optional[Session] = None) -> None:
    if not params_list:
        return
    with _session_scope(db) as (session, owns):
        converted, _ = _transform_qmark_sql(sql, params_list[0])
        batch = []
        for params in params_list:
            _, bind_params = _transform_qmark_sql(sql, params)
            batch.append(bind_params)
        session.execute(text(converted), batch)
        session.commit()
        logger.info("DB executemany query=%s batch_size=%d", converted, len(batch))


def row_to_dict(row: Optional[dict]) -> Optional[dict]:
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows: list[dict]) -> list[dict]:
    return [dict(r) for r in rows]
