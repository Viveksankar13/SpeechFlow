"""
Pydantic schemas for Transcriptions.
"""
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

LanguageMode = Literal["auto", "en-IN", "hi-IN", "ml-IN"]
TranscriptionMode = Literal["VERBATIM", "SMART"]
RecordingStatus = Literal["draft", "recording", "paused", "completed", "failed"]
SaveMethod = Literal["automatic", "manual", "system"]


class TranscriptionCreate(BaseModel):
    title: str = Field(default="Untitled Recording", max_length=255)
    language_mode: LanguageMode = Field(default="auto")
    transcription_mode: TranscriptionMode = Field(default="VERBATIM")


class TranscriptionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    transcript_text: str | None = None


class TranscriptionSaveRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    transcript_text: str | None = None


class TranscriptionResponse(BaseModel):
    id: uuid.UUID
    title: str
    transcript_text: str
    detected_language: str | None
    language_label: str | None
    transcription_mode: str
    recording_status: str
    duration_ms: int | None
    save_method: str | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PaginatedTranscriptionsResponse(BaseModel):
    items: list[TranscriptionResponse]
    total: int
    page: int
    page_size: int
    pages: int
