"""
Smoke test: verify the FastAPI app starts and health endpoints respond.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_liveness():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_no_db():
    """Readiness will return 503 when no DB is configured — that's expected in unit tests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health/ready")
    # 200 (connected) or 503 (degraded) — both are valid responses, not crashes
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "database" in data
