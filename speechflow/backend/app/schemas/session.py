"""
Pydantic schemas for anonymous sessions and WebSocket tokens.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AnonymousSessionResponse(BaseModel):
    session_id: uuid.UUID
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WSTokenResponse(BaseModel):
    ws_token: str
    expires_in_seconds: int
