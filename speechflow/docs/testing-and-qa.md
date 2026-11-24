# SpeechFlow — Testing and Quality Assurance Guide

This document describes how to execute automated tests, perform integration checks, run the Gemini Live verification tool, and evaluate multilingual speech recognition.

---

## 1. Automated Backend Test Suite

The backend contains a comprehensive test suite covering all layers:
- Health check endpoints (`/health/live`, `/health/ready`)
- Repository CRUD and anonymous session isolation boundaries
- WebSocket token generation, single-use enforcement, and expiration
- REST API pagination, title search, and ownership security
- Real-time `GeminiSessionManager` event flows, pause/resume, and autosave persistence
- WebSocket handshake authentication and error handling

### Running the Tests

Ensure your virtual environment is active:

```bash
cd speechflow/backend
# On Windows:
.venv\Scripts\python -m pytest tests -v
# On macOS/Linux:
.venv/bin/python -m pytest tests -v
```

Expected result:
```text
======================== 27 passed, 1 warning in 6.45s ========================
```

---

## 2. Frontend Build and Type Verification

Verify Next.js compilation, TypeScript types, and Turbopack route bundling:

```bash
cd speechflow/frontend
npm run build
```

Expected result:
```text
✓ Compiled successfully
  Running TypeScript ...
  Finished TypeScript
✓ Generating static pages (6/6)
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /dashboard
└ ◐ /transcriptions/[id]
```

---

## 3. Real Gemini Live API Verification

Before deploying, verify end-to-end communication with Google's Gemini Live API using the standalone verification utility:

```bash
cd speechflow/backend
.venv\Scripts\python verify_gemini_live.py --api-key YOUR_GEMINI_API_KEY
```

What the tool validates:
1. Validates API key and SDK initialization (`google-genai`).
2. Establishes a bidirectional WebSocket connection to the Gemini Live service (`gemini-3.5-transcribe-live`).
3. Synthesizes a 16 kHz 16-bit mono PCM audio stream (the exact format streamed by the browser's AudioWorklet).
4. Streams audio in 100ms (3200-byte) chunks.
5. Receives live server events (`interim`, `final`).
6. Gracefully terminates and closes the session.

---

## 4. Multilingual & Code-Switching Test Matrix

SpeechFlow is designed to process multilingual speech without manual language toggling. Use the following test phrases with a live microphone:

| Scenario | Spoken Input | Expected Script & Output |
| :--- | :--- | :--- |
| **English** | *"Today we are launching the SpeechFlow real-time audio application."* | Latin characters: English words transcribed verbatim. |
| **Hindi** | *"मुझे एक नया प्रोजेक्ट बनाना है, क्या आप मेरी मदद कर सकते हैं?"* | Devanagari script: Native Hindi representation. |
| **Malayalam** | *"ഇന്ന് ഞാൻ ഒരു പുതിയ പ്രോജക്റ്റ് തുടങ്ങാൻ പോകുകയാണ്."* | Malayalam script: Native Malayalam characters. |
| **Hinglish (Code-Switching)** | *"मुझे एक new project बनाना है, can you help me?"* | Mixed Devanagari + Latin characters preserving spoken terms. |
| **Manglish (Code-Switching)** | *"Hello, ഇന്ന് ഞാൻ ഒരു പുതിയ project തുടങ്ങാൻ പോകുകയാണ്."* | Mixed Latin + Malayalam characters preserving code-switched boundaries. |

### Multilingual Script Rules
1. **No forced translation:** Words are not translated into English.
2. **No automated transliteration:** Malayalam and Hindi speech appear in their native scripts (Malayalam & Devanagari), while English words appear in Latin script.
3. **Auto Detect Default:** The `auto` mode leaves the language code list empty, instructing Gemini to dynamically detect the spoken language.

---

## 5. End-to-End Local Development Workflow

To run the complete stack locally with Docker Compose:

1. Copy environment templates:
   ```bash
   cp speechflow/backend/.env.example speechflow/backend/.env
   cp speechflow/frontend/.env.example speechflow/frontend/.env.local
   ```
2. Set your `GEMINI_API_KEY` in `speechflow/backend/.env`.
3. Launch all services:
   ```bash
   cd speechflow
   docker compose up --build
   ```
4. Access:
   - Frontend UI: `http://localhost:3000`
   - Backend API Docs: `http://localhost:8000/docs`
   - Health check: `http://localhost:8000/health/live`
