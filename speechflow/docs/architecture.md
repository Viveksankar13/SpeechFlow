# SpeechFlow — System Architecture

## Overview
SpeechFlow is a real-time multilingual speech-to-text web application leveraging Google's Gemini Live API for speech recognition and Supabase PostgreSQL for persistent transcription storage.

## Architectural Flow
```
Browser Microphone (navigator.mediaDevices.getUserMedia)
  │
  ▼
Web Audio API + AudioWorklet (16 kHz PCM conversion)
  │
  ▼
WebSocket Connection (Binary frames for audio, JSON for controls)
  │
  ▼
FastAPI Backend (Session validation & orchestration)
  │
  ▼
Gemini Live API (gemini-3.5-transcribe-live)
  │
  ├── Interim Transcripts (low-latency streaming previews)
  └── Finalized Transcripts (authoritative utterances)
  │
  ▼
FastAPI Backend (Database persistence via SQLAlchemy + asyncpg)
  │
  ├──► Supabase PostgreSQL (Persistent storage)
  └──► Next.js Frontend (Real-time UI updates via WebSocket)
```

## Key Architectural Decisions
1. **Server-Side AI Integration**: Gemini API credentials remain strictly on the backend. The browser communicates only with FastAPI.
2. **Dual-Token Auth**: HttpOnly session cookies for REST; short-lived single-use tokens for WebSocket handshakes across origins.
3. **Audio Streaming**: 16-bit PCM mono at 16,000 Hz sent in ~100ms chunks (1600 samples) via binary WebSocket frames.
4. **Session Resumption**: Transparent renewal before the ~10-minute Gemini Live connection timeout using session handles to prevent transcription loss.
