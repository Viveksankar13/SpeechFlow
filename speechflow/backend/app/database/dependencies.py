"""
FastAPI dependency for database sessions.
"""
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.engine import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass
            raise
        finally:
            try:
                await session.rollback()
            except Exception:
                pass
            try:
                await session.close()
            except Exception:
                pass
