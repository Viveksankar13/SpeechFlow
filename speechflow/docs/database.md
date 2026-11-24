# SpeechFlow — Database Design (Supabase PostgreSQL)

## Overview
SpeechFlow uses Supabase PostgreSQL as its persistent storage layer. All access is performed asynchronously through the FastAPI backend via SQLAlchemy 2.x and `asyncpg`.

## Connection Configuration
- **Supabase Session Pooler**: Port 5432 is recommended for long-lived backend Web Services on Render.
- **Supabase Transaction Pooler**: Port 6543 requires `NullPool` and `connect_args={"prepared_statement_cache_size": 0}` to prevent duplicate prepared statement collisions.

## Entity Relationship Diagram
```mermaid
erDiagram
    anonymous_sessions {
        UUID id PK
        VARCHAR token_hash UK
        TIMESTAMP created_at
        TIMESTAMP last_seen_at
        TIMESTAMP expires_at
        TIMESTAMP revoked_at
    }

    ws_tokens {
        UUID id PK
        UUID anonymous_session_id FK
        VARCHAR token UK
        TIMESTAMP expires_at
        BOOLEAN used
        TIMESTAMP created_at
    }

    transcriptions {
        UUID id PK
        UUID anonymous_session_id FK
        VARCHAR title
        TEXT transcript_text
        VARCHAR detected_language
        VARCHAR language_label
        VARCHAR transcription_mode
        VARCHAR recording_status
        BIGINT duration_ms
        VARCHAR save_method
        JSONB metadata
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP started_at
        TIMESTAMP completed_at
    }

    anonymous_sessions ||--o{ transcriptions : "owns"
    anonymous_sessions ||--o{ ws_tokens : "authorizes"
```

## Tables & Indexes
- `anonymous_sessions`: Primary key UUID, unique index on `token_hash`.
- `ws_tokens`: Primary key UUID, foreign key to `anonymous_sessions.id` (CASCADE), index on `token` and `expires_at`.
- `transcriptions`: Primary key UUID, foreign key to `anonymous_sessions.id` (CASCADE), indexes on `anonymous_session_id`, `(anonymous_session_id, created_at DESC)`, and `recording_status`.
