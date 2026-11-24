"""
Endpoints for anonymous session creation, retrieval, and WebSocket token issuance.
"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.dependencies import get_db
from app.api.deps import get_current_session
from app.models.session import AnonymousSession
from app.schemas.session import AnonymousSessionResponse, WSTokenResponse
from app.services.session.session_service import SessionService

router = APIRouter()


@router.post(
    "/anonymous-session",
    response_model=AnonymousSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize or reset an anonymous session",
)
async def create_anonymous_session(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a new anonymous session. Sets an HttpOnly, SameSite, Secure cookie
    in the response and returns the session identifier and expiry timestamp.
    """
    service = SessionService(db)
    session = await service.create_session(response)
    return AnonymousSessionResponse(
        session_id=session.id,
        created_at=session.created_at,
        expires_at=session.expires_at,
    )


@router.get(
    "/anonymous-session",
    response_model=AnonymousSessionResponse,
    summary="Get current active anonymous session metadata",
)
async def get_anonymous_session(
    current_session: AnonymousSession = Depends(get_current_session),
):
    """
    Returns the metadata of the caller's active anonymous session.
    Fails with 401 if the session cookie is absent or expired.
    """
    return AnonymousSessionResponse(
        session_id=current_session.id,
        created_at=current_session.created_at,
        expires_at=current_session.expires_at,
    )


@router.get(
    "/ws-token",
    response_model=WSTokenResponse,
    summary="Obtain a short-lived token for WebSocket connection",
)
async def get_ws_token(
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a single-use token valid for 60 seconds to authenticate
    a WebSocket handshake across origins where cookies are not sent.
    """
    service = SessionService(db)
    token_str, ttl = await service.create_ws_token(current_session.id)
    return WSTokenResponse(
        ws_token=token_str,
        expires_in_seconds=ttl,
    )
