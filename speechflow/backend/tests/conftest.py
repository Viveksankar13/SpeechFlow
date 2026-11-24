"""
pytest configuration and shared fixtures for SpeechFlow backend tests.
"""
from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.database.dependencies import get_db
from app.core.config import settings
from app.core.security import generate_session_token, hash_token
from app.models.session import AnonymousSession
from app.models.ws_token import WSToken
from app.models.transcription import Transcription


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_db_engine():
    """Create a fresh in-memory database with all tables for each test."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    except Exception:
        pass
    try:
        await engine.dispose()
    except Exception:
        pass


@pytest_asyncio.fixture(scope="function")
async def db_session(test_db_engine) -> AsyncSession:
    """Provide a database session bound to the in-memory test database."""
    session_factory = async_sessionmaker(
        bind=test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncClient:
    """
    Provide an HTTPX AsyncClient with get_db dependency overridden
    to use the isolated in-memory test database session.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sync_client(test_db_engine):
    """
    Provide a Starlette TestClient with get_db overridden using a dedicated
    session from the test engine for WebSocket testing.
    """
    from starlette.testclient import TestClient

    session_factory = async_sessionmaker(
        bind=test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db():
        async with session_factory() as session:
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

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def create_test_session(db_session: AsyncSession):
    """
    Factory fixture: creates an AnonymousSession in the DB
    and returns (session_model, raw_token).
    """
    async def _create(
        ttl_days: int = 30,
        expired: bool = False,
        revoked: bool = False,
    ) -> tuple[AnonymousSession, str]:
        raw_token = generate_session_token()
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)

        if expired:
            expires_at = now - timedelta(hours=1)
        else:
            expires_at = now + timedelta(days=ttl_days)

        revoked_at = now if revoked else None

        session = AnonymousSession(
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=revoked_at,
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        return session, raw_token

    return _create
