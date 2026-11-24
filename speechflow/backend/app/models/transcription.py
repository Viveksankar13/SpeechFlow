"""
Transcription ORM model.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, GUID, JSONB_TYPE


class Transcription(Base):
    __tablename__ = "transcriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4
    )
    anonymous_session_id: Mapped[uuid.UUID] = mapped_column(
        GUID,
        ForeignKey("anonymous_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Recording")
    transcript_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Language metadata
    detected_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    language_label: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Mode & status
    transcription_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="VERBATIM")
    recording_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", index=True
    )

    # Recording metadata
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    save_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB_TYPE, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    session: Mapped["AnonymousSession"] = relationship(  # noqa: F821
        "AnonymousSession", back_populates="transcriptions"
    )

    __table_args__ = (
        Index("idx_transcriptions_session_created", "anonymous_session_id", "created_at"),
    )
