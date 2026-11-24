"""
Tests for GeminiSessionManager: verifies real-time event dispatching,
automatic database persistence of finalized segments, pause/resume, and graceful stop.
"""
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcription import Transcription
from app.repositories.transcription_repo import TranscriptionRepository
from app.services.gemini.session_manager import GeminiSessionManager
from app.services.gemini.transcript_provider import MockTranscriptionProvider


@pytest.mark.asyncio
async def test_session_manager_event_flow_and_autosave(
    db_session: AsyncSession, create_test_session
):
    session, _ = await create_test_session()
    tx_repo = TranscriptionRepository(db_session)
    tx = await tx_repo.create(
        anonymous_session_id=session.id,
        title="Live Test",
        transcription_mode="VERBATIM",
    )

    interim_events: list[str] = []
    final_events: list[tuple[str, str]] = []
    status_events: list[str] = []

    async def on_interim(text: str):
        interim_events.append(text)

    async def on_final(segment: str, full: str):
        final_events.append((segment, full))

    async def on_status(st: str):
        status_events.append(st)

    mock_provider = MockTranscriptionProvider(
        responses=[
            {"type": "interim", "text": "Hello today"},
            {"type": "interim", "text": "Hello today I am testing"},
            {
                "type": "final",
                "segment_text": "Hello today I am testing SpeechFlow.",
                "text": "Hello today I am testing SpeechFlow.",
            },
        ]
    )

    manager = GeminiSessionManager(
        transcription_id=tx.id,
        anonymous_session_id=session.id,
        db=db_session,
        provider=mock_provider,
        on_interim_transcript=on_interim,
        on_final_transcript=on_final,
        on_status_change=on_status,
    )

    # Start session
    await manager.start(language_mode="auto", transcription_mode="VERBATIM")
    assert "connecting" in status_events
    assert "recording" in status_events

    # Send dummy audio
    await manager.send_audio_chunk(b"\x00" * 3200)
    assert mock_provider._audio_received == 3200

    # Wait for mock events to process
    import asyncio
    for _ in range(20):
        if len(final_events) >= 1:
            break
        await asyncio.sleep(0.05)

    assert len(interim_events) >= 2
    assert interim_events[0] == "Hello today"
    assert len(final_events) == 1
    assert final_events[0][0] == "Hello today I am testing SpeechFlow."

    # Verify AUTOMATIC DATABASE PERSISTENCE occurred without manual save
    refreshed_tx = await tx_repo.get_by_id_and_session(tx.id, session.id)
    assert refreshed_tx is not None
    assert refreshed_tx.transcript_text == "Hello today I am testing SpeechFlow."
    assert refreshed_tx.save_method == "automatic"

    # Stop session
    final_text = await manager.stop()
    assert final_text == "Hello today I am testing SpeechFlow."
    assert "completed" in status_events

    # Verify marked completed in database
    completed_tx = await tx_repo.get_by_id_and_session(tx.id, session.id)
    assert completed_tx.recording_status == "completed"
    assert completed_tx.completed_at is not None


@pytest.mark.asyncio
async def test_session_manager_pause_and_resume(
    db_session: AsyncSession, create_test_session
):
    session, _ = await create_test_session()
    tx_repo = TranscriptionRepository(db_session)
    tx = await tx_repo.create(anonymous_session_id=session.id, title="Pause Test")

    mock_provider = MockTranscriptionProvider(responses=[])
    manager = GeminiSessionManager(
        transcription_id=tx.id,
        anonymous_session_id=session.id,
        db=db_session,
        provider=mock_provider,
    )

    await manager.start()

    # Active: audio is forwarded
    await manager.send_audio_chunk(b"\x00" * 1000)
    assert mock_provider._audio_received == 1000

    # Pause: audio is NOT forwarded
    await manager.pause()
    assert manager.is_paused is True
    await manager.send_audio_chunk(b"\x00" * 1000)
    assert mock_provider._audio_received == 1000  # Still 1000, not 2000

    # Resume: audio forwarding resumes
    await manager.resume()
    assert manager.is_paused is False
    await manager.send_audio_chunk(b"\x00" * 1000)
    assert mock_provider._audio_received == 2000

    await manager.stop()


@pytest.mark.asyncio
async def test_gemini_provider_parses_native_live_transcription_events():
    """Verify GeminiLiveTranscriptionProvider extracts interim_input_transcription and input_transcription."""
    from google.genai import types
    from app.services.gemini.transcript_provider import GeminiLiveTranscriptionProvider

    fake_messages = [
        types.LiveServerMessage(
            server_content=types.LiveServerContent(
                interim_input_transcription=types.Transcription(text="Hello today")
            )
        ),
        types.LiveServerMessage(
            server_content=types.LiveServerContent(
                interim_input_transcription=types.Transcription(text="Hello, today I am testing")
            )
        ),
        types.LiveServerMessage(
            server_content=types.LiveServerContent(
                input_transcription=types.Transcription(text="Hello, today I am testing.")
            )
        ),
        types.LiveServerMessage(
            server_content=types.LiveServerContent(generation_complete=True)
        ),
    ]

    class FakeSession:
        def __init__(self, messages):
            self._messages = messages
            self._yielded = False

        async def receive(self):
            if self._yielded:
                return
            self._yielded = True
            for m in self._messages:
                yield m

        async def send_realtime_input(self, **kwargs):
            return None

    provider = GeminiLiveTranscriptionProvider()
    provider.session = FakeSession(fake_messages)
    provider._is_connected = True

    events = []
    async for ev in provider.receive_events():
        events.append(ev)
        if ev["type"] == "final":
            provider._is_connected = False

    assert events == [
        {"type": "interim", "text": "Hello today"},
        {"type": "interim", "text": "Hello, today I am testing"},
        {"type": "final", "segment_text": "Hello, today I am testing.", "text": "Hello, today I am testing."},
    ]
