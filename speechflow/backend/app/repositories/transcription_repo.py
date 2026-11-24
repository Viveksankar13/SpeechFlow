"""
Database repository for Transcription records.
Enforces session ownership on every operation.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, update, delete, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcription import Transcription


class TranscriptionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        anonymous_session_id: uuid.UUID,
        title: str = "Untitled Recording",
        transcription_mode: str = "VERBATIM",
        recording_status: str = "draft",
        detected_language: str | None = None,
        language_label: str | None = None,
    ) -> Transcription:
        """Create a new transcription record owned by anonymous_session_id."""
        tx = Transcription(
            anonymous_session_id=anonymous_session_id,
            title=title,
            transcript_text="",
            transcription_mode=transcription_mode,
            recording_status=recording_status,
            detected_language=detected_language,
            language_label=language_label,
            started_at=datetime.now(timezone.utc) if recording_status == "recording" else None,
        )
        self.db.add(tx)
        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def get_by_id_and_session(
        self, transcription_id: uuid.UUID, anonymous_session_id: uuid.UUID
    ) -> Transcription | None:
        """Fetch a single transcription record only if owned by anonymous_session_id."""
        query = select(Transcription).where(
            Transcription.id == transcription_id,
            Transcription.anonymous_session_id == anonymous_session_id,
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def list_by_session(
        self,
        anonymous_session_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
        search: str | None = None,
        sort_desc: bool = True,
        status: str | None = None,
    ) -> tuple[list[Transcription], int]:
        """
        List paginated transcription history owned by anonymous_session_id.
        Returns (items, total_count).
        """
        base_filter = [Transcription.anonymous_session_id == anonymous_session_id]

        if status:
            base_filter.append(Transcription.recording_status == status)

        if search and search.strip():
            search_pattern = f"%{search.strip()}%"
            base_filter.append(Transcription.title.ilike(search_pattern))

        # Count total items matching filter
        count_query = select(func.count(Transcription.id)).where(*base_filter)
        total_res = await self.db.execute(count_query)
        total = total_res.scalar_one()

        # Query paginated rows
        order = desc(Transcription.created_at) if sort_desc else asc(Transcription.created_at)
        rows_query = (
            select(Transcription)
            .where(*base_filter)
            .order_by(order)
            .offset(offset)
            .limit(limit)
        )
        rows_res = await self.db.execute(rows_query)
        items = list(rows_res.scalars().all())

        return items, total

    async def update(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        title: str | None = None,
        transcript_text: str | None = None,
        save_method: str | None = None,
        recording_status: str | None = None,
        duration_ms: int | None = None,
        detected_language: str | None = None,
        language_label: str | None = None,
        completed_at: datetime | None = None,
    ) -> Transcription | None:
        """Update transcription fields ensuring strict session ownership."""
        values = {"updated_at": datetime.now(timezone.utc)}

        if title is not None:
            values["title"] = title
        if transcript_text is not None:
            values["transcript_text"] = transcript_text
        if save_method is not None:
            values["save_method"] = save_method
        if recording_status is not None:
            values["recording_status"] = recording_status
        if duration_ms is not None:
            values["duration_ms"] = duration_ms
        if detected_language is not None:
            values["detected_language"] = detected_language
        if language_label is not None:
            values["language_label"] = language_label
        if completed_at is not None:
            values["completed_at"] = completed_at

        stmt = (
            update(Transcription)
            .where(
                Transcription.id == transcription_id,
                Transcription.anonymous_session_id == anonymous_session_id,
            )
            .values(**values)
        )
        result = await self.db.execute(stmt)
        if result.rowcount == 0:
            return None

        await self.db.commit()
        return await self.get_by_id_and_session(transcription_id, anonymous_session_id)

    async def delete(
        self, transcription_id: uuid.UUID, anonymous_session_id: uuid.UUID
    ) -> bool:
        """Delete a transcription verifying session ownership."""
        stmt = delete(Transcription).where(
            Transcription.id == transcription_id,
            Transcription.anonymous_session_id == anonymous_session_id,
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0
