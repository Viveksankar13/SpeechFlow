"""
Database repository for short-lived WebSocket tokens (WSToken).
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.base import ensure_utc
from app.models.ws_token import WSToken
from app.models.session import AnonymousSession


class WSTokenRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        anonymous_session_id: uuid.UUID,
        token: str,
        expires_at: datetime,
    ) -> WSToken:
        """Create and persist a single-use WebSocket token."""
        ws_token = WSToken(
            anonymous_session_id=anonymous_session_id,
            token=token,
            expires_at=expires_at,
            used=False,
        )
        self.db.add(ws_token)
        await self.db.commit()
        await self.db.refresh(ws_token)
        return ws_token

    async def consume_token(self, token_str: str) -> AnonymousSession | None:
        """
        Validate and consume a WebSocket token atomically.
        Returns the associated AnonymousSession if valid and not expired/used.
        Returns None if invalid, expired, or already used.
        """
        now = datetime.now(timezone.utc)
        query = (
            select(WSToken)
            .options(joinedload(WSToken.session))
            .where(
                WSToken.token == token_str,
                WSToken.used.is_(False),
                WSToken.expires_at > now,
            )
        )
        result = await self.db.execute(query)
        token_record = result.scalars().first()

        if not token_record or not token_record.session:
            return None

        # Check if the parent session itself is valid & not expired
        session_expires_at = ensure_utc(token_record.session.expires_at)
        if (
            token_record.session.revoked_at is not None
            or (session_expires_at and session_expires_at <= now)
        ):
            return None

        # Mark token as used immediately (single-use guarantee)
        token_record.used = True
        await self.db.commit()

        return token_record.session
