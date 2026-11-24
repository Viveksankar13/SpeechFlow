"""
Transcription provider abstraction and Gemini Live implementation.
Provides a clean interface for live audio streaming and deterministic unit testing.
"""
import abc
import asyncio
from typing import AsyncIterator, Literal
from google.genai import types

from app.core.config import settings
from app.core.logging import get_logger
from app.services.gemini.client import get_gemini_client

logger = get_logger(__name__)

TranscriptionEvent = dict[str, str | bool]


class BaseTranscriptionProvider(abc.ABC):
    """Abstract interface for speech transcription streaming engines."""

    @abc.abstractmethod
    async def connect(self, language_mode: str = "auto", transcription_mode: str = "VERBATIM") -> None:
        """Establish streaming session."""
        pass

    @abc.abstractmethod
    async def send_audio(self, pcm_chunk: bytes) -> None:
        """Send raw 16kHz 16-bit PCM mono audio chunk."""
        pass

    @abc.abstractmethod
    async def receive_events(self) -> AsyncIterator[TranscriptionEvent]:
        """Stream transcription events: interim and final."""
        pass

    @abc.abstractmethod
    async def close(self) -> None:
        """Terminate streaming session cleanly."""
        pass

    async def flush_audio(self) -> None:
        """Signal end of speech stream to flush any pending transcription."""
        return None


class GeminiLiveTranscriptionProvider(BaseTranscriptionProvider):
    """
    Real-time multilingual transcription using Google's Gemini Live API.
    Model: gemini-3.5-transcribe-live (or configured live model)
    Format: 16kHz, mono, PCM 16-bit little-endian
    """

    def __init__(self):
        self.client = get_gemini_client()
        self._live_context = None
        self.session = None
        self._is_connected = False
        self._current_interim = ""
        self._current_model_text = ""
        self._language_mode = "auto"
        self._transcription_mode = "VERBATIM"

    def _build_system_instruction(self, language_mode: str) -> str:
        lang_hint = ""
        if language_mode == "en-IN":
            lang_hint = "The primary expected spoken language is Indian English."
        elif language_mode == "hi-IN":
            lang_hint = "The primary expected spoken language is Hindi. Transcribe in Devanagari script."
        elif language_mode == "ml-IN":
            lang_hint = "The primary expected spoken language is Malayalam. Transcribe in Malayalam script."
        else:
            lang_hint = (
                "The user may speak English, Hindi, Malayalam, or naturally code-switch between them "
                "within the same utterance."
            )

        smart_instruction = ""
        if self._transcription_mode == "SMART":
            smart_instruction = (
                "Format the text cleanly: omit stuttering, disfluencies, and filler words like 'um', 'uh', 'ah'."
            )
        else:
            smart_instruction = (
                "Transcribe verbatim exactly what is spoken without altering words."
            )

        return (
            f"You are a dedicated real-time speech transcriber for SpeechFlow. {lang_hint}\n"
            "MANDATORY INSTRUCTIONS:\n"
            "1. Output ONLY the transcription text for the received audio. Do NOT reply conversationally.\n"
            "2. Preserve native writing scripts:\n"
            "   - Hindi speech must appear in Devanagari script.\n"
            "   - Malayalam speech must appear in Malayalam script.\n"
            "   - English speech must appear in Latin characters.\n"
            "   - Code-switched sentences must preserve both scripts for their respective words without transliterating to English.\n"
            f"3. {smart_instruction}\n"
            "4. Do NOT translate into another language. Output the original spoken words."
        )

    async def connect(self, language_mode: str = "auto", transcription_mode: str = "VERBATIM") -> None:
        self._language_mode = language_mode
        self._transcription_mode = transcription_mode
        sys_instruction = self._build_system_instruction(language_mode)

        config = types.LiveConnectConfig(
            response_modalities=["TEXT"],
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=sys_instruction)]
            ),
        )

        model_name = settings.gemini_live_model
        logger.info(
            "Connecting to Gemini Live API (model=%s, lang=%s, mode=%s)",
            model_name,
            language_mode,
            transcription_mode,
        )

        try:
            self._live_context = self.client.aio.live.connect(
                model=model_name,
                config=config,
            )
            self.session = await self._live_context.__aenter__()
            self._is_connected = True
            self._current_interim = ""
            self._current_model_text = ""
            logger.info("Connected to Gemini Live session.")
        except Exception as exc:
            logger.error("Failed to connect to Gemini Live API: %s", exc)
            self._is_connected = False
            self._live_context = None
            self.session = None
            raise

    async def send_audio(self, pcm_chunk: bytes) -> None:
        if not self._is_connected or not self.session:
            return

        blob = types.Blob(data=pcm_chunk, mime_type="audio/pcm;rate=16000")
        try:
            await self.session.send_realtime_input(audio=blob)
        except Exception as exc:
            logger.warning("Error streaming audio chunk to Gemini: %s", exc)
            raise

    async def flush_audio(self) -> None:
        """Signal audio_stream_end so Gemini Live flushes pending final transcription."""
        if not self._is_connected or not self.session:
            return
        try:
            await self.session.send_realtime_input(audio_stream_end=True)
        except Exception as exc:
            logger.debug("Ignoring error flushing audio stream to Gemini: %s", exc)

    async def receive_events(self) -> AsyncIterator[TranscriptionEvent]:
        if not self._is_connected or not self.session:
            return

        try:
            while self._is_connected and self.session:
                received_any = False
                async for message in self.session.receive():
                    received_any = True
                    if not message:
                        continue

                    server_content = message.server_content
                    if not server_content:
                        continue

                    # 1. Native live transcription events (gemini-3.5-transcribe-live)
                    # Note: interim_input_transcription.text is cumulative for the current utterance.
                    interim_tr = getattr(server_content, "interim_input_transcription", None)
                    interim_text = getattr(interim_tr, "text", None) if interim_tr else None
                    if interim_text and interim_text.strip():
                        self._current_interim = interim_text
                        yield {
                            "type": "interim",
                            "text": interim_text,
                        }

                    final_tr = getattr(server_content, "input_transcription", None)
                    final_text = getattr(final_tr, "text", None) if final_tr else None
                    if final_text and final_text.strip():
                        cleaned_final = final_text.strip()
                        self._current_interim = ""
                        yield {
                            "type": "final",
                            "segment_text": cleaned_final,
                            "text": cleaned_final,
                        }

                    # 2. Fallback for standard Live models that respond via model_turn text parts
                    text_chunk = getattr(message, "text", None)
                    if not text_chunk and server_content.model_turn:
                        for part in (server_content.model_turn.parts or []):
                            if getattr(part, "text", None):
                                text_chunk = (text_chunk or "") + part.text

                    if text_chunk:
                        self._current_model_text += text_chunk
                        self._current_interim = self._current_model_text
                        yield {
                            "type": "interim",
                            "text": self._current_model_text,
                        }

                    if (server_content.turn_complete or getattr(server_content, "generation_complete", False)) and self._current_model_text.strip():
                        final_segment = self._current_model_text.strip()
                        self._current_model_text = ""
                        self._current_interim = ""
                        yield {
                            "type": "final",
                            "segment_text": final_segment,
                            "text": final_segment,
                        }

                if not received_any:
                    break

        except asyncio.CancelledError:
            logger.info("Gemini receive loop cancelled.")
            raise
        except Exception as exc:
            if not self._is_connected:
                logger.info("Gemini receive loop ended after close.")
                return
            logger.error("Gemini receive stream error: %s", exc)
            yield {
                "type": "error",
                "message": str(exc),
            }

    async def close(self) -> None:
        self._is_connected = False
        if self._live_context:
            try:
                await self._live_context.__aexit__(None, None, None)
                logger.info("Gemini Live session closed.")
            except Exception as exc:
                logger.warning("Error closing Gemini session: %s", exc)
            finally:
                self._live_context = None
                self.session = None


class MockTranscriptionProvider(BaseTranscriptionProvider):
    """Deterministic mock provider for unit tests."""

    def __init__(self, responses: list[TranscriptionEvent] | None = None):
        self._is_connected = False
        self._responses = responses or [
            {"type": "interim", "text": "Hello today"},
            {"type": "interim", "text": "Hello today I am testing"},
            {
                "type": "final",
                "segment_text": "Hello today I am testing SpeechFlow.",
                "text": "Hello today I am testing SpeechFlow.",
            },
        ]
        self._audio_received = 0

    async def connect(self, language_mode: str = "auto", transcription_mode: str = "VERBATIM") -> None:
        self._is_connected = True

    async def send_audio(self, pcm_chunk: bytes) -> None:
        if self._is_connected:
            self._audio_received += len(pcm_chunk)

    async def receive_events(self) -> AsyncIterator[TranscriptionEvent]:
        for event in self._responses:
            await asyncio.sleep(0.01)
            yield event

    async def close(self) -> None:
        self._is_connected = False
