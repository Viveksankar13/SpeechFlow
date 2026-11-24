"""
AnonymousSession ORM model.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, GUID


class AnonymousSession(Base):
    __tablename__ = "anonymous_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    transcriptions: Mapped[list["Transcription"]] = relationship(  # noqa: F821
        "Transcription", back_populates="session", cascade="all, delete-orphan"
    )
    ws_tokens: Mapped[list["WSToken"]] = relationship(  # noqa: F821
        "WSToken", back_populates="session", cascade="all, delete-orphan"
    )
