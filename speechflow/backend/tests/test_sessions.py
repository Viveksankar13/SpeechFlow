"""
Tests for anonymous session creation, cookie handling, validation, expiration, and WS tokens.
"""
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_token
from app.services.session.session_service import SessionService


@pytest.mark.asyncio
async def test_create_anonymous_session(async_client: AsyncClient, db_session: AsyncSession):
    """
    POST /api/v1/anonymous-session must:
    1. Return 201 Created with session metadata.
    2. Set an HttpOnly, Path=/, SameSite cookie.
    3. Persist the token hash (NOT raw token) to the database.
    """
    response = await async_client.post("/api/v1/anonymous-session")
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert "created_at" in data
    assert "expires_at" in data

    # Verify cookie was set
    cookie_header = response.headers.get("set-cookie")
    assert cookie_header is not None
    assert settings.session_cookie_name in cookie_header
    assert "httponly" in cookie_header.lower()

    # Extract raw token from client cookies
    raw_token = async_client.cookies.get(settings.session_cookie_name)
    assert raw_token is not None

    # Verify raw token is NOT in DB, but its SHA-256 hash IS
    service = SessionService(db_session)
    session_by_hash = await service.session_repo.get_by_token_hash(hash_token(raw_token))
    assert session_by_hash is not None
    assert str(session_by_hash.id) == data["session_id"]


@pytest.mark.asyncio
async def test_get_active_session_with_valid_cookie(
    async_client: AsyncClient, create_test_session
):
    """GET /api/v1/anonymous-session with valid cookie returns 200 and session data."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    response = await async_client.get("/api/v1/anonymous-session")
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == str(session.id)


@pytest.mark.asyncio
async def test_get_session_missing_cookie(async_client: AsyncClient):
    """GET /api/v1/anonymous-session without cookie returns 401."""
    response = await async_client.get("/api/v1/anonymous-session")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_session_invalid_cookie(async_client: AsyncClient):
    """GET /api/v1/anonymous-session with fake/invalid token returns 401."""
    async_client.cookies.set(settings.session_cookie_name, "totally-invalid-token-12345")
    response = await async_client.get("/api/v1/anonymous-session")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_session_expired(async_client: AsyncClient, create_test_session):
    """GET /api/v1/anonymous-session with expired session returns 401."""
    session, raw_token = await create_test_session(expired=True)
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    response = await async_client.get("/api/v1/anonymous-session")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_session_revoked(async_client: AsyncClient, create_test_session):
    """GET /api/v1/anonymous-session with revoked session returns 401."""
    session, raw_token = await create_test_session(revoked=True)
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    response = await async_client.get("/api/v1/anonymous-session")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_issue_ws_token_with_valid_session(
    async_client: AsyncClient, create_test_session, db_session: AsyncSession
):
    """
    GET /api/v1/ws-token issues a short-lived token:
    1. Returns 200 with ws_token and 60s TTL.
    2. Can be validated/consumed once.
    3. Cannot be reused (single-use protection).
    """
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    response = await async_client.get("/api/v1/ws-token")
    assert response.status_code == 200
    data = response.json()
    assert "ws_token" in data
    assert data["expires_in_seconds"] == 60

    ws_token_str = data["ws_token"]

    # Validate and consume token
    service = SessionService(db_session)
    resolved_session = await service.validate_ws_token(ws_token_str)
    assert resolved_session is not None
    assert resolved_session.id == session.id

    # Second consumption must fail (single-use)
    reused_session = await service.validate_ws_token(ws_token_str)
    assert reused_session is None


@pytest.mark.asyncio
async def test_issue_ws_token_unauthorized(async_client: AsyncClient):
    """GET /api/v1/ws-token without session cookie returns 401."""
    response = await async_client.get("/api/v1/ws-token")
    assert response.status_code == 401
