"""
Service managing anonymous sessions, secure HttpOnly cookies, and WebSocket tokens.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Request, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_session_token, hash_token, generate_ws_token
from app.models.base import ensure_utc
from app.models.session import AnonymousSession
from app.repositories.session_repo import SessionRepository
from app.repositories.ws_token_repo import WSTokenRepository


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.ws_token_repo = WSTokenRepository(db)

    async def create_session(self, response: Response) -> AnonymousSession:
        """
        Generate a cryptographically secure token, persist its hash,
        and attach an HttpOnly secure cookie to the HTTP response.
        """
        raw_token = generate_session_token()
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.session_ttl_days)

        session = await self.session_repo.create(
            token_hash=token_hash,
            expires_at=expires_at,
        )

        # Set secure HttpOnly cookie
        max_age_seconds = int(timedelta(days=settings.session_ttl_days).total_seconds())
        response.set_cookie(
            key=settings.session_cookie_name,
            value=raw_token,
            max_age=max_age_seconds,
            expires=expires_at,
            path="/",
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
        )

        return session

    async def get_session_from_request(self, request: Request) -> AnonymousSession | None:
        """
        Read anonymous session from cookie or headers, verify validity and expiration.
        Supports:
        1. Cookie (speechflow_session)
        2. Header X-Session-Token (raw token)
        3. Header X-Session-ID (UUID session ID)
        """
        now = datetime.now(timezone.utc)

        # 1. Try cookie or raw token header
        raw_token = request.cookies.get(settings.session_cookie_name) or request.headers.get("x-session-token")
        if raw_token:
            token_hash = hash_token(raw_token)
            session = await self.session_repo.get_by_token_hash(token_hash)
            if session:
                expires_at = ensure_utc(session.expires_at)
                if not expires_at or expires_at > now:
                    await self.session_repo.update_last_seen(session.id)
                    return session

        # 2. Try X-Session-ID header as fallback for cross-origin/cross-port dev
        session_id_header = request.headers.get("x-session-id")
        if session_id_header:
            try:
                sid = uuid.UUID(session_id_header.strip())
                session = await self.session_repo.get_by_id(sid)
                if session and not session.revoked_at:
                    expires_at = ensure_utc(session.expires_at)
                    if not expires_at or expires_at > now:
                        await self.session_repo.update_last_seen(session.id)
                        return session
            except (ValueError, TypeError):
                pass

        return None

    async def create_ws_token(self, session_id: uuid.UUID) -> tuple[str, int]:
        """
        Generate a single-use, 60-second valid token for WebSocket authentication.
        Returns (token_string, ttl_seconds).
        """
        token_str = generate_ws_token()
        ttl_seconds = 60
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)

        await self.ws_token_repo.create(
            anonymous_session_id=session_id,
            token=token_str,
            expires_at=expires_at,
        )
        return token_str, ttl_seconds

    async def validate_ws_token(self, token_str: str) -> AnonymousSession | None:
        """
        Validate and consume a WebSocket authentication token.
        Returns the owning AnonymousSession if valid; None otherwise.
        """
        return await self.ws_token_repo.consume_token(token_str)
