# SpeechFlow — WebSocket Protocol

## Endpoint
`wss://<domain>/api/v1/ws/transcribe?token=<ws_token>`

## Connection Handshake
1. Client fetches short-lived `ws_token` via `GET /api/v1/ws-token`.
2. Client opens WebSocket connection passing `?token=<ws_token>`.
3. Backend validates token from database, binds connection to the owning anonymous session, and marks token as used.

## Client-to-Server Messages (JSON & Binary)

### 1. Start Recording
```json
{
  "type": "start",
  "transcription_id": "UUID",
  "language_mode": "auto",
  "transcription_mode": "VERBATIM"
}
```

### 2. Stream Audio
Raw binary frames: 16-bit PCM, 16 kHz, mono, little-endian, ~1600 samples (100ms) per frame.

### 3. Pause
```json
{ "type": "pause" }
```

### 4. Resume
```json
{ "type": "resume" }
```

### 5. Stop
```json
{ "type": "stop" }
```

### 6. Heartbeat
```json
{ "type": "ping" }
```

## Server-to-Client Messages (JSON)

### 1. Ready
```json
{ "type": "ready", "transcription_id": "UUID" }
```

### 2. Interim Transcript (Live preview)
```json
{ "type": "interim_transcript", "text": "Hello today I am" }
```

### 3. Final Transcript (Committed segment)
```json
{
  "type": "final_transcript",
  "segment_text": "Hello today I am starting a new project.",
  "transcript_text": "Hello today I am starting a new project."
}
```

### 4. Status Update
```json
{ "type": "recording_status", "status": "recording" }
```

### 5. Saved (Autosave confirmation)
```json
{ "type": "saved", "save_method": "automatic", "transcription_id": "UUID" }
```

### 6. Completed
```json
{ "type": "completed", "transcription_id": "UUID", "transcript_text": "..." }
```

### 7. Error
```json
{ "type": "error", "code": "GEMINI_ERROR", "message": "User-friendly error explanation" }
```
