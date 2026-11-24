"""
Pydantic schemas for WebSocket messages (client <-> server).
"""
import uuid
from typing import Literal
from pydantic import BaseModel, Field

# Client to Server message types
ClientMessageType = Literal["start", "pause", "resume", "stop", "ping"]


class WSStartMessage(BaseModel):
    type: Literal["start"]
    transcription_id: uuid.UUID
    language_mode: Literal["auto", "en-IN", "hi-IN", "ml-IN"] = "auto"
    transcription_mode: Literal["VERBATIM", "SMART"] = "VERBATIM"


class WSPauseMessage(BaseModel):
    type: Literal["pause"]


class WSResumeMessage(BaseModel):
    type: Literal["resume"]


class WSStopMessage(BaseModel):
    type: Literal["stop"]


class WSPingMessage(BaseModel):
    type: Literal["ping"]


# Server to Client message types
class WSReadyEvent(BaseModel):
    type: Literal["ready"] = "ready"
    transcription_id: uuid.UUID


class WSInterimTranscriptEvent(BaseModel):
    type: Literal["interim_transcript"] = "interim_transcript"
    text: str


class WSFinalTranscriptEvent(BaseModel):
    type: Literal["final_transcript"] = "final_transcript"
    segment_text: str
    transcript_text: str


class WSRecordingStatusEvent(BaseModel):
    type: Literal["recording_status"] = "recording_status"
    status: str


class WSSavedEvent(BaseModel):
    type: Literal["saved"] = "saved"
    save_method: str
    transcription_id: uuid.UUID


class WSCompletedEvent(BaseModel):
    type: Literal["completed"] = "completed"
    transcription_id: uuid.UUID
    transcript_text: str


class WSPongEvent(BaseModel):
    type: Literal["pong"] = "pong"


class WSErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str
