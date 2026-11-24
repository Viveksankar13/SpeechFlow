"""
Alembic environment configuration.
Supports async SQLAlchemy engine for PostgreSQL migrations.
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

# Import all models so Alembic can detect them
from app.models.base import Base
from app.models.session import AnonymousSession  # noqa: F401
from app.models.ws_token import WSToken  # noqa: F401
from app.models.transcription import Transcription  # noqa: F401
from app.core.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from env var
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL script)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using async engine."""
    is_sqlite = settings.database_url.startswith("sqlite")
    is_local = any(h in settings.database_url for h in ["localhost", "127.0.0.1", "@postgres:"])
    ssl_mode = "disable" if (is_local and not settings.is_production) else "require"

    connect_args = {}
    if not is_sqlite:
        connect_args["prepared_statement_cache_size"] = 0
        connect_args["ssl"] = ssl_mode

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
