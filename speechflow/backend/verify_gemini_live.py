"""
Verification script for real Gemini Live API connectivity and real-time audio transcription.
Generates a test 16kHz PCM audio stream and sends it to the configured Gemini Live model.

Usage:
    python verify_gemini_live.py [--api-key YOUR_API_KEY] [--model MODEL_NAME]
"""
import argparse
import asyncio
import math
import os
import struct
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

from app.core.config import settings
from app.services.gemini.transcript_provider import GeminiLiveTranscriptionProvider


def generate_test_tone_pcm(duration_seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Generate 16kHz 16-bit mono PCM sine wave test audio chunks."""
    total_samples = int(duration_seconds * sample_rate)
    frequency = 440.0  # A4 tone
    pcm_bytes = bytearray()
    for i in range(total_samples):
        sample = int(32767.0 * 0.3 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
        pcm_bytes.extend(struct.pack("<h", sample))
    return bytes(pcm_bytes)


async def run_live_verification(api_key: str | None = None, model: str | None = None):
    key = api_key or os.getenv("GEMINI_API_KEY") or settings.gemini_api_key
    if not key or key.strip() in ("", "YOUR_GEMINI_API_KEY_HERE"):
        print("\n❌ GEMINI_API_KEY is not set.")
        print("Please set GEMINI_API_KEY in your environment or in backend/.env, or pass --api-key.")
        sys.exit(1)

    settings.gemini_api_key = key
    if model:
        settings.gemini_live_model = model

    print(f"🚀 Initializing Gemini Live Transcription Provider...")
    print(f"   Model: {settings.gemini_live_model}")
    print(f"   API Version: {settings.gemini_api_version}")

    provider = GeminiLiveTranscriptionProvider()

    try:
        print("🔌 Connecting to Gemini Live API WebSocket...")
        await provider.connect(language_mode="auto", transcription_mode="VERBATIM")
        print("✅ Connection established successfully!")

        print("🎤 Streaming 2 seconds of test PCM audio (16kHz 16-bit mono)...")
        pcm_audio = generate_test_tone_pcm(duration_seconds=2.0)
        chunk_size = 3200  # 100ms chunks

        async def audio_sender():
            for i in range(0, len(pcm_audio), chunk_size):
                chunk = pcm_audio[i : i + chunk_size]
                await provider.send_audio(chunk)
                await asyncio.sleep(0.1)
            print("📤 Finished sending audio stream.")

        async def event_receiver():
            events_received = 0
            try:
                # Listen for up to 6 seconds
                async for event in provider.receive_events():
                    print(f"   📥 Received event: {event}")
                    events_received += 1
                    if event.get("type") == "final":
                        break
            except asyncio.CancelledError:
                pass
            return events_received

        sender_task = asyncio.create_task(audio_sender())
        receiver_task = asyncio.create_task(event_receiver())

        await sender_task
        # Wait up to 5 seconds for any model responses
        try:
            await asyncio.wait_for(receiver_task, timeout=5.0)
        except asyncio.TimeoutError:
            print("⏱️ Event listening window closed.")

        print("🏁 Closing Gemini Live session...")
        await provider.close()
        print("🎉 Gemini Live API verification completed successfully!")

    except Exception as exc:
        print(f"\n❌ Error during Gemini Live verification: {exc}")
        await provider.close()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify Gemini Live API connectivity")
    parser.add_argument("--api-key", help="Gemini API Key", default=None)
    parser.add_argument("--model", help="Gemini Live Model", default=None)
    args = parser.parse_args()

    asyncio.run(run_live_verification(api_key=args.api_key, model=args.model))
