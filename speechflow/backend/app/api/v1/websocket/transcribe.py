"""
Real-time audio streaming and live transcription WebSocket endpoint.
Handles token authentication, origin validation, binary PCM routing, and JSON control frames.
"""
import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.database.dependencies import get_db
from app.schemas.websocket import (
    WSStartMessage,
    WSPauseMessage,
    WSResumeMessage,
    WSStopMessage,
    WSPingMessage,
    WSReadyEvent,
    WSInterimTranscriptEvent,
    WSFinalTranscriptEvent,
    WSRecordingStatusEvent,
    WSSavedEvent,
    WSCompletedEvent,
    WSPongEvent,
    WSErrorEvent,
)
from app.services.gemini.session_manager import GeminiSessionManager
from app.services.session.session_service import SessionService
from app.services.transcription.transcription_service import TranscriptionService

logger = get_logger(__name__)
router = APIRouter()


@router.websocket("/ws/transcribe")
async def websocket_transcribe(
    websocket: WebSocket,
    token: str = Query(..., description="Short-lived single-use WebSocket authentication token"),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for bidirectional real-time audio streaming.
    - Query parameter ?token= is validated and consumed atomically.
    - Binary frames carry 16 kHz 16-bit PCM mono audio.
    - Text frames carry JSON control messages and transcript events.
    """
    # 1. Validate Origin header if present
    origin = websocket.headers.get("origin")
    if origin and settings.is_production:
        if origin not in settings.allowed_origins:
            logger.warning("Rejected WebSocket connection from unauthorized origin: %s", origin)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # 2. Authenticate token
    session_service = SessionService(db)
    anonymous_session = await session_service.validate_ws_token(token)

    if not anonymous_session:
        logger.warning("Rejected WebSocket connection: invalid or expired token.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3. Accept connection
    await websocket.accept()
    logger.info("WebSocket connected for anonymous session: %s", anonymous_session.id)

    session_manager: GeminiSessionManager | None = None
    session_id = anonymous_session.id

    # Event dispatch callbacks
    async def send_interim(text: str):
        try:
            event = WSInterimTranscriptEvent(text=text)
            await websocket.send_text(event.model_dump_json())
        except Exception:
            pass

    async def send_final(segment_text: str, full_transcript: str):
        try:
            final_event = WSFinalTranscriptEvent(
                segment_text=segment_text,
                transcript_text=full_transcript,
            )
            await websocket.send_text(final_event.model_dump_json())

            # Also send autosave notification
            saved_event = WSSavedEvent(
                save_method="automatic",
                transcription_id=session_manager.transcription_id,
            )
            await websocket.send_text(saved_event.model_dump_json())
        except Exception:
            pass

    async def send_status(st: str):
        try:
            event = WSRecordingStatusEvent(status=st)
            await websocket.send_text(event.model_dump_json())
        except Exception:
            pass

    async def send_error(code: str, message: str):
        try:
            event = WSErrorEvent(code=code, message=message)
            await websocket.send_text(event.model_dump_json())
        except Exception:
            pass

    # 4. Message loop
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            # Handle binary audio frame
            if "bytes" in message and message["bytes"]:
                pcm_data = message["bytes"]
                if session_manager and session_manager.is_active:
                    await session_manager.send_audio_chunk(pcm_data)
                continue

            # Handle JSON text frame
            if "text" in message and message["text"]:
                raw_text = message["text"]
                try:
                    payload = json.loads(raw_text)
                except json.JSONDecodeError:
                    await send_error("INVALID_JSON", "Malformed JSON frame received.")
                    continue

                msg_type = payload.get("type")

                # Heartbeat
                if msg_type == "ping":
                    pong = WSPongEvent()
                    await websocket.send_text(pong.model_dump_json())
                    continue

                # Start recording
                if msg_type == "start":
                    try:
                        start_msg = WSStartMessage.model_validate(payload)
                    except Exception as exc:
                        await send_error("INVALID_START_MESSAGE", str(exc))
                        continue

                    # Validate transcription ownership in database
                    tx_service = TranscriptionService(db)
                    tx = await tx_service.repo.get_by_id_and_session(
                        start_msg.transcription_id, session_id
                    )
                    if not tx:
                        await send_error(
                            "TRANSCRIPTION_NOT_FOUND",
                            "Transcription session not found or access denied.",
                        )
                        continue

                    # Create session manager with the active DB session
                    session_manager = GeminiSessionManager(
                        transcription_id=start_msg.transcription_id,
                        anonymous_session_id=session_id,
                        db=db,
                        on_interim_transcript=send_interim,
                        on_final_transcript=send_final,
                        on_status_change=send_status,
                        on_error=send_error,
                    )

                    # Acknowledge ready
                    ready_event = WSReadyEvent(transcription_id=start_msg.transcription_id)
                    await websocket.send_text(ready_event.model_dump_json())

                    # Start Live session
                    await session_manager.start(
                        language_mode=start_msg.language_mode,
                        transcription_mode=start_msg.transcription_mode,
                    )

                # Pause
                elif msg_type == "pause":
                    if session_manager:
                        await session_manager.pause()

                # Resume
                elif msg_type == "resume":
                    if session_manager:
                        await session_manager.resume()

                # Stop
                elif msg_type == "stop":
                    if session_manager:
                        final_text = await session_manager.stop()
                        completed_event = WSCompletedEvent(
                            transcription_id=session_manager.transcription_id,
                            transcript_text=final_text,
                        )
                        await websocket.send_text(completed_event.model_dump_json())
                        session_manager = None

    except (WebSocketDisconnect, RuntimeError):
        logger.info("WebSocket disconnected for session: %s", session_id)
    except Exception as exc:
        logger.exception("Unexpected error in WebSocket loop: %s", exc)
    finally:
        # Ensure session manager cleans up if disconnected unexpectedly
        if session_manager and session_manager.is_active:
            try:
                await session_manager.stop()
            except Exception:
                pass
