"""
API v1 router — aggregates all endpoint sub-routers.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import health, sessions, transcriptions
from app.api.v1.websocket import transcribe

api_v1_router = APIRouter()

# Health (standard /health and versioned /api/v1/health)
api_v1_router.include_router(health.router, prefix="/health", tags=["Health"])
api_v1_router.include_router(health.router, prefix="/api/v1/health", tags=["Health"])

# API v1
api_v1_router.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
api_v1_router.include_router(transcriptions.router, prefix="/api/v1", tags=["Transcriptions"])
api_v1_router.include_router(transcribe.router, prefix="/api/v1", tags=["WebSocket"])
