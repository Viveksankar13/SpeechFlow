"""
GeminiSessionManager: orchestrates real-time audio forwarding, event dispatching,
automatic persistence of finalized segments, and connection lifecycle.
"""
import asyncio
import time
import uuid
from typing import Callable, Coroutine, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.services.gemini.transcript_provider import (
    BaseTranscriptionProvider,
    GeminiLiveTranscriptionProvider,
)
from app.services.transcription.transcription_service import TranscriptionService

logger = get_logger(__name__)

# Max lifetime before proactive rotation (9.5 minutes = 570 seconds)
SESSION_ROTATION_SECONDS = 570


class GeminiSessionManager:
    def __init__(
        self,
        transcription_id: uuid.UUID,
        anonymous_session_id: uuid.UUID,
        db: AsyncSession,
        provider: BaseTranscriptionProvider | None = None,
        on_interim_transcript: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_final_transcript: Callable[[str, str], Coroutine[Any, Any, None]] | None = None,
        on_status_change: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_error: Callable[[str, str], Coroutine[Any, Any, None]] | None = None,
    ):
        self.transcription_id = transcription_id
        self.anonymous_session_id = anonymous_session_id
        self.db = db
        self.provider = provider or GeminiLiveTranscriptionProvider()
        self.tx_service = TranscriptionService(db)

        # Callbacks
        self.on_interim_transcript = on_interim_transcript
        self.on_final_transcript = on_final_transcript
        self.on_status_change = on_status_change
        self.on_error = on_error

        # State
        self.is_active = False
        self.is_paused = False
        self.start_time: float = 0.0
        self.accumulated_text = ""
        self.current_interim = ""
        self._receive_task: asyncio.Task | None = None
        self._final_received_event = asyncio.Event()
        self._db_lock = asyncio.Lock()
        self._language_mode = "auto"
        self._transcription_mode = "VERBATIM"

    async def start(
        self,
        language_mode: str = "auto",
        transcription_mode: str = "VERBATIM",
    ) -> None:
        """Initialize provider and start receiving events."""
        self._language_mode = language_mode
        self._transcription_mode = transcription_mode
        self.start_time = time.monotonic()
        self.is_active = True
        self.is_paused = False

        if self.on_status_change:
            await self.on_status_change("connecting")

        try:
            await self.provider.connect(language_mode, transcription_mode)
        except Exception as exc:
            self.is_active = False
            if self.on_error:
                await self.on_error("GEMINI_CONNECTION_ERROR", str(exc))
            return

        if self.on_status_change:
            await self.on_status_change("recording")

        # Start event listening task
        self._receive_task = asyncio.create_task(self._event_loop())

    async def _event_loop(self) -> None:
        """Listen to incoming provider events and handle persistence."""
        try:
            async for event in self.provider.receive_events():
                event_type = event.get("type")

                # Check if rotation is needed (~10 min limit)
                elapsed = time.monotonic() - self.start_time
                if elapsed >= SESSION_ROTATION_SECONDS and self.is_active:
                    await self._rotate_provider_session()

                if event_type == "interim":
                    text = str(event.get("text", ""))
                    self.current_interim = text
                    if self.on_interim_transcript:
                        await self.on_interim_transcript(text)

                elif event_type == "final":
                    segment = str(event.get("segment_text", "")).strip()
                    self.current_interim = ""
                    if segment:
                        # Append segment to cumulative text
                        if self.accumulated_text:
                            self.accumulated_text += " " + segment
                        else:
                            self.accumulated_text = segment

                        # Automatic persistence to Supabase/PostgreSQL (serialized with lock)
                        duration_ms = int((time.monotonic() - self.start_time) * 1000)
                        async with self._db_lock:
                            await self.tx_service.autosave_segment(
                                transcription_id=self.transcription_id,
                                anonymous_session_id=self.anonymous_session_id,
                                transcript_text=self.accumulated_text,
                                duration_ms=duration_ms,
                            )

                        if self.on_final_transcript:
                            await self.on_final_transcript(segment, self.accumulated_text)
                    self._final_received_event.set()

                elif event_type == "error":
                    msg = str(event.get("message", "Unknown provider error"))
                    logger.error("Provider emitted error: %s", msg)
                    if self.on_error:
                        await self.on_error("GEMINI_ERROR", msg)

        except asyncio.CancelledError:
            logger.info("Event loop task cancelled.")
        except Exception as exc:
            logger.exception("Unexpected error in GeminiSessionManager event loop: %s", exc)
            if self.on_error:
                await self.on_error("INTERNAL_ERROR", "Streaming processing error.")

    async def _rotate_provider_session(self) -> None:
        """Rotate provider connection before the ~10 min limit to prevent drops."""
        logger.info("Proactively rotating Gemini Live session to prevent connection drop.")
        if self.on_status_change:
            await self.on_status_change("reconnecting")

        try:
            old_provider = self.provider
            # Initialize new provider
            new_provider = GeminiLiveTranscriptionProvider()
            await new_provider.connect(self._language_mode, self._transcription_mode)
            self.provider = new_provider
            self.start_time = time.monotonic()
            await old_provider.close()
            logger.info("Gemini Live session rotated successfully.")
            if self.on_status_change:
                await self.on_status_change("recording")
        except Exception as exc:
            logger.error("Failed to rotate Gemini session: %s", exc)
            if self.on_status_change:
                await self.on_status_change("recording")

    async def send_audio_chunk(self, chunk: bytes) -> None:
        """Forward binary PCM chunk if active and not paused."""
        if not self.is_active or self.is_paused:
            return
        await self.provider.send_audio(chunk)

    async def pause(self) -> None:
        """Pause recording (temporarily stop forwarding audio and flush utterance)."""
        self.is_paused = True
        await self.provider.flush_audio()
        if self.on_status_change:
            await self.on_status_change("paused")

    async def resume(self) -> None:
        """Resume recording."""
        self.is_paused = False
        if self.on_status_change:
            await self.on_status_change("recording")

    async def stop(self) -> str:
        """Gracefully stop recording, finalize transcript, and persist completed record."""
        self.is_active = False
        if self.on_status_change:
            await self.on_status_change("finalizing")

        # Flush any trailing buffered speech to Gemini and wait briefly for final segment
        self._final_received_event.clear()
        await self.provider.flush_audio()

        if self.current_interim:
            try:
                await asyncio.wait_for(self._final_received_event.wait(), timeout=1.5)
            except asyncio.TimeoutError:
                pass
        else:
            await asyncio.sleep(0.3)

        # Cancel event loop and close provider BEFORE final DB write so no concurrent AsyncSession access happens
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        await self.provider.close()

        # If there was trailing interim text not yet committed as final, append it
        trailing = self.current_interim.strip()
        if trailing:
            if self.accumulated_text:
                self.accumulated_text += " " + trailing
            else:
                self.accumulated_text = trailing
            self.current_interim = ""

        duration_ms = int((time.monotonic() - self.start_time) * 1000)

        # Mark completed in database
        async with self._db_lock:
            await self.tx_service.complete_recording(
                transcription_id=self.transcription_id,
                anonymous_session_id=self.anonymous_session_id,
                transcript_text=self.accumulated_text,
                duration_ms=duration_ms,
            )

        if self.on_status_change:
            await self.on_status_change("completed")

        return self.accumulated_text
