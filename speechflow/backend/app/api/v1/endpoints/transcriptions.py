"""
REST API endpoints for Transcription CRUD, pagination, search, and manual saves.
Strictly enforces anonymous session ownership.
"""
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.dependencies import get_db
from app.api.deps import get_current_session
from app.models.session import AnonymousSession
from app.schemas.transcription import (
    TranscriptionCreate,
    TranscriptionUpdate,
    TranscriptionSaveRequest,
    TranscriptionResponse,
    PaginatedTranscriptionsResponse,
)
from app.services.transcription.transcription_service import TranscriptionService
from app.utils.pagination import PaginationParams

router = APIRouter()


@router.post(
    "/transcriptions",
    response_model=TranscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new logical transcription session record",
)
async def create_transcription(
    data: TranscriptionCreate,
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    tx = await service.create_transcription(current_session.id, data)
    return TranscriptionResponse.model_validate(tx)


@router.get(
    "/transcriptions",
    response_model=PaginatedTranscriptionsResponse,
    summary="List transcription history for current anonymous session",
)
async def list_transcriptions(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(default=None, description="Search query matching title"),
    sort: str = Query(
        default="created_at_desc", description="Sort order"
    ),
    status_filter: str | None = Query(
        default=None, alias="status", description="Filter by recording status"
    ),
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    pagination = PaginationParams(page=page, page_size=page_size)
    return await service.list_transcriptions(
        anonymous_session_id=current_session.id,
        pagination=pagination,
        search=search,
        sort=sort,
        status_filter=status_filter,
    )


@router.get(
    "/transcriptions/{transcription_id}",
    response_model=TranscriptionResponse,
    summary="Retrieve a single transcription by ID",
)
async def get_transcription(
    transcription_id: uuid.UUID,
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    tx = await service.get_transcription_or_404(transcription_id, current_session.id)
    return TranscriptionResponse.model_validate(tx)


@router.patch(
    "/transcriptions/{transcription_id}",
    response_model=TranscriptionResponse,
    summary="Update transcription title and/or transcript text",
)
async def update_transcription(
    transcription_id: uuid.UUID,
    data: TranscriptionUpdate,
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    tx = await service.update_transcription(transcription_id, current_session.id, data)
    return TranscriptionResponse.model_validate(tx)


@router.post(
    "/transcriptions/{transcription_id}/save",
    response_model=TranscriptionResponse,
    summary="Explicit manual save of title and transcript text",
)
async def manual_save_transcription(
    transcription_id: uuid.UUID,
    data: TranscriptionSaveRequest,
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    tx = await service.manual_save(transcription_id, current_session.id, data)
    return TranscriptionResponse.model_validate(tx)


@router.delete(
    "/transcriptions/{transcription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a transcription record",
)
async def delete_transcription(
    transcription_id: uuid.UUID,
    current_session: AnonymousSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    service = TranscriptionService(db)
    await service.delete_transcription(transcription_id, current_session.id)
    return None
