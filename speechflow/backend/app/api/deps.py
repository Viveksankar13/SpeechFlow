"""
FastAPI route dependencies for authentication and session resolution.
"""
from fastapi import Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.dependencies import get_db
from app.models.session import AnonymousSession
from app.services.session.session_service import SessionService


async def get_current_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AnonymousSession:
    """
    Dependency that enforces an active anonymous session via cookie.
    Raises 401 Unauthorized if cookie is missing, expired, or invalid.
    """
    service = SessionService(db)
    session = await service.get_session_from_request(request)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid anonymous session required. Call POST /api/v1/anonymous-session first.",
        )
    return session


async def get_optional_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AnonymousSession | None:
    """Dependency that extracts the session if present, but does not raise an exception."""
    service = SessionService(db)
    return await service.get_session_from_request(request)
