"""
WSToken ORM model — short-lived tokens for WebSocket authentication.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, GUID


class WSToken(Base):
    __tablename__ = "ws_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4
    )
    anonymous_session_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("anonymous_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session: Mapped["AnonymousSession"] = relationship(  # noqa: F821
        "AnonymousSession", back_populates="ws_tokens"
    )
