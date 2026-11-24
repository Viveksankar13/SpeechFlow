"""
Health check endpoints.
"""
from datetime import datetime, timezone
from fastapi import APIRouter
from sqlalchemy import text

from app.database.engine import engine
from app.core.config import settings

router = APIRouter()


@router.get("")
@router.get("/")
async def health_root():
    """General health check."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/live")
async def liveness():
    """Kubernetes/Render liveness probe — is the process alive?"""
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/ready")
async def readiness():
    """Readiness probe — can the service handle requests?"""
    db_status = "connected"
    db_error = None

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "disconnected"
        db_error = str(exc) if not settings.is_production else "Database unreachable."

    status = "ready" if db_status == "connected" else "degraded"
    response = {
        "status": status,
        "database": db_status,
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if db_error:
        response["database_error"] = db_error

    from fastapi.responses import JSONResponse
    code = 200 if status == "ready" else 503
    return JSONResponse(content=response, status_code=code)
