"""
TranscriptionService: handles business logic for transcription CRUD,
manual saving, and autosaving while enforcing strict anonymous session ownership.
"""
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcription import Transcription
from app.repositories.transcription_repo import TranscriptionRepository
from app.schemas.transcription import (
    TranscriptionCreate,
    TranscriptionUpdate,
    TranscriptionSaveRequest,
    TranscriptionResponse,
    PaginatedTranscriptionsResponse,
)
from app.utils.pagination import PaginationParams

LANGUAGE_LABEL_MAP: dict[str, str] = {
    "auto": "Auto Detect",
    "en-IN": "English",
    "hi-IN": "Hindi",
    "ml-IN": "Malayalam",
}


class TranscriptionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TranscriptionRepository(db)

    async def create_transcription(
        self,
        anonymous_session_id: uuid.UUID,
        data: TranscriptionCreate,
    ) -> Transcription:
        """Create a new transcription record for the current session."""
        language_label = LANGUAGE_LABEL_MAP.get(data.language_mode, "Auto Detect")
        detected_lang = None if data.language_mode == "auto" else data.language_mode

        return await self.repo.create(
            anonymous_session_id=anonymous_session_id,
            title=data.title or "Untitled Recording",
            transcription_mode=data.transcription_mode,
            recording_status="draft",
            detected_language=detected_lang,
            language_label=language_label,
        )

    async def get_transcription_or_404(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
    ) -> Transcription:
        """Fetch a transcription record ensuring session ownership. Raises 404 if not found."""
        tx = await self.repo.get_by_id_and_session(transcription_id, anonymous_session_id)
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcription not found or access denied.",
            )
        return tx

    async def list_transcriptions(
        self,
        anonymous_session_id: uuid.UUID,
        pagination: PaginationParams,
        search: str | None = None,
        sort: str = "created_at_desc",
        status_filter: str | None = None,
    ) -> PaginatedTranscriptionsResponse:
        """List paginated history for current session."""
        sort_desc = sort not in ("created_at_asc", "created_at", "asc")

        items, total = await self.repo.list_by_session(
            anonymous_session_id=anonymous_session_id,
            offset=pagination.offset,
            limit=pagination.page_size,
            search=search,
            sort_desc=sort_desc,
            status=status_filter,
        )

        import math
        pages = max(1, math.ceil(total / pagination.page_size)) if total > 0 else 1

        response_items = [TranscriptionResponse.model_validate(tx) for tx in items]
        return PaginatedTranscriptionsResponse(
            items=response_items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
            pages=pages,
        )

    async def update_transcription(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        data: TranscriptionUpdate,
    ) -> Transcription:
        """Update title and/or transcript text with session ownership verification."""
        # Ensure it exists and belongs to this session
        await self.get_transcription_or_404(transcription_id, anonymous_session_id)

        updated = await self.repo.update(
            transcription_id=transcription_id,
            anonymous_session_id=anonymous_session_id,
            title=data.title,
            transcript_text=data.transcript_text,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcription not found or access denied.",
            )
        return updated

    async def manual_save(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        data: TranscriptionSaveRequest,
    ) -> Transcription:
        """Perform an explicit manual save."""
        # Ensure it exists and belongs to this session
        await self.get_transcription_or_404(transcription_id, anonymous_session_id)

        updated = await self.repo.update(
            transcription_id=transcription_id,
            anonymous_session_id=anonymous_session_id,
            title=data.title,
            transcript_text=data.transcript_text,
            save_method="manual",
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcription not found or access denied.",
            )
        return updated

    async def autosave_segment(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        transcript_text: str,
        detected_language: str | None = None,
        duration_ms: int | None = None,
    ) -> Transcription:
        """Autosave finalized transcript text emitted from the Live API."""
        return await self.repo.update(
            transcription_id=transcription_id,
            anonymous_session_id=anonymous_session_id,
            transcript_text=transcript_text,
            save_method="automatic",
            recording_status="recording",
            detected_language=detected_language,
            duration_ms=duration_ms,
        )

    async def complete_recording(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        transcript_text: str | None = None,
        duration_ms: int | None = None,
    ) -> Transcription:
        """Finalize a recording session."""
        now = datetime.now(timezone.utc)
        return await self.repo.update(
            transcription_id=transcription_id,
            anonymous_session_id=anonymous_session_id,
            transcript_text=transcript_text,
            recording_status="completed",
            duration_ms=duration_ms,
            completed_at=now,
        )

    async def delete_transcription(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
    ) -> None:
        """Permanently delete a transcription record."""
        # Ensure existence & ownership
        await self.get_transcription_or_404(transcription_id, anonymous_session_id)

        deleted = await self.repo.delete(transcription_id, anonymous_session_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcription not found or access denied.",
            )
