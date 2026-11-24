"""
SQLAlchemy declarative base and shared column defaults.
"""
import uuid
import sys
from datetime import datetime, timezone
from sqlalchemy import func, Uuid, JSON
from sqlalchemy.dialects.postgresql import JSONB as PGJSONB
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped

# Compatibility patch for Python 3.14 + SQLAlchemy 2.0.x typing union bug
if sys.version_info >= (3, 14):
    import sqlalchemy.util.typing as _st
    from functools import reduce
    import operator

    def _make_union_type(*types):
        return reduce(operator.or_, types)

    _st.make_union_type = _make_union_type


def utcnow() -> datetime:
    """Return current UTC timestamp with timezone awareness."""
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """Ensure a datetime is timezone-aware UTC (fixes SQLite naive datetime issues)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# Cross-compatible column types: native PostgreSQL in production, standard SQLite in tests
GUID = Uuid(as_uuid=True)
JSONB_TYPE = JSON().with_variant(PGJSONB(), "postgresql")

__all__ = [
    "Base",
    "utcnow",
    "GUID",
    "JSONB_TYPE",
    "uuid",
    "Mapped",
    "mapped_column",
    "func",
]
