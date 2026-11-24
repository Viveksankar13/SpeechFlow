"""
Database repository for AnonymousSession records.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import AnonymousSession


class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, token_hash: str, expires_at: datetime) -> AnonymousSession:
        """Create and persist a new anonymous session."""
        session = AnonymousSession(
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_by_token_hash(self, token_hash: str) -> AnonymousSession | None:
        """Find active, non-revoked session by token hash."""
        query = select(AnonymousSession).where(
            AnonymousSession.token_hash == token_hash,
            AnonymousSession.revoked_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_by_id(self, session_id: uuid.UUID) -> AnonymousSession | None:
        """Find session by primary key ID."""
        query = select(AnonymousSession).where(
            AnonymousSession.id == session_id,
            AnonymousSession.revoked_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def update_last_seen(self, session_id: uuid.UUID) -> None:
        """Touch last_seen_at timestamp for an active session."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(AnonymousSession)
            .where(AnonymousSession.id == session_id)
            .values(last_seen_at=now)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def revoke(self, session_id: uuid.UUID) -> None:
        """Revoke a session explicitly."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(AnonymousSession)
            .where(AnonymousSession.id == session_id)
            .values(revoked_at=now)
        )
        await self.db.execute(stmt)
        await self.db.commit()
