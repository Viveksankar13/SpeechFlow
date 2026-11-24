"""
Async SQLAlchemy engine and session factory.
"""
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

is_sqlite = settings.database_url.startswith("sqlite")

if is_sqlite:
    engine = create_async_engine(
        settings.database_url,
        echo=settings.environment == "development",
        connect_args={"check_same_thread": False},
    )
else:
    # Use NullPool so the external Supabase pooler manages connections.
    # This avoids DuplicatePreparedStatementError with transaction pooler.
    is_local = any(h in settings.database_url for h in ["localhost", "127.0.0.1", "@postgres:"])
    ssl_mode = "disable" if (is_local and not settings.is_production) else "require"

    engine = create_async_engine(
        settings.database_url,
        echo=settings.environment == "development",
        poolclass=NullPool,
        connect_args={
            "prepared_statement_cache_size": 0,
            "ssl": ssl_mode,
        },
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
