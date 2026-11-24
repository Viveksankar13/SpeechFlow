# SpeechFlow — REST API Contract

## Base URL
`/api/v1`

## Authentication
Anonymous session cookie (`speechflow_session`). Sent automatically via `credentials: "include"`.

## Endpoints

### 1. Health
- `GET /health/live`: Liveness check (200 OK)
- `GET /health/ready`: Readiness check (200 OK when DB connected, 503 Service Unavailable when degraded)

### 2. Anonymous Sessions
- `POST /api/v1/anonymous-session`: Initializes anonymous session and sets `HttpOnly`, `SameSite`, `Secure` cookie.
- `GET /api/v1/anonymous-session`: Returns active session identity metadata.
- `GET /api/v1/ws-token`: Generates a single-use, 60-second valid token for WebSocket handshake authentication.

### 3. Transcriptions
- `POST /api/v1/transcriptions`: Creates a new transcription record (draft status).
  - Body: `{"title": string, "language_mode": "auto"|"en-IN"|"hi-IN"|"ml-IN", "transcription_mode": "VERBATIM"|"SMART"}`
- `GET /api/v1/transcriptions`: Retrieves paginated history for current session.
  - Query parameters: `page`, `page_size`, `search`, `sort`, `status`
- `GET /api/v1/transcriptions/{id}`: Retrieves single transcription by ID.
- `PATCH /api/v1/transcriptions/{id}`: Updates title or transcript text.
- `POST /api/v1/transcriptions/{id}/save`: Explicit manual save endpoint.
- `DELETE /api/v1/transcriptions/{id}`: Permanently deletes a transcription record.
