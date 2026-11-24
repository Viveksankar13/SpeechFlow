"""Initial schema: anonymous_sessions, ws_tokens, transcriptions

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Table: anonymous_sessions
    op.create_table(
        "anonymous_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "idx_anon_sessions_token_hash",
        "anonymous_sessions",
        ["token_hash"],
        unique=True,
    )

    # 2. Table: ws_tokens
    op.create_table(
        "ws_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("anonymous_session_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["anonymous_session_id"],
            ["anonymous_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(
        "idx_ws_tokens_token",
        "ws_tokens",
        ["token"],
        unique=True,
    )
    op.create_index(
        "idx_ws_tokens_expires",
        "ws_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "idx_ws_tokens_session_id",
        "ws_tokens",
        ["anonymous_session_id"],
        unique=False,
    )

    # 3. Table: transcriptions
    op.create_table(
        "transcriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("anonymous_session_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("transcript_text", sa.Text(), nullable=False),
        sa.Column("detected_language", sa.String(length=16), nullable=True),
        sa.Column("language_label", sa.String(length=64), nullable=True),
        sa.Column("transcription_mode", sa.String(length=16), nullable=False),
        sa.Column("recording_status", sa.String(length=16), nullable=False),
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("save_method", sa.String(length=16), nullable=True),
        sa.Column(
            "metadata",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["anonymous_session_id"],
            ["anonymous_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_transcriptions_session_id",
        "transcriptions",
        ["anonymous_session_id"],
        unique=False,
    )
    op.create_index(
        "idx_transcriptions_session_created",
        "transcriptions",
        ["anonymous_session_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_transcriptions_status",
        "transcriptions",
        ["recording_status"],
        unique=False,
    )
    op.create_index(
        "idx_transcriptions_created_at",
        "transcriptions",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_transcriptions_created_at", table_name="transcriptions")
    op.drop_index("idx_transcriptions_status", table_name="transcriptions")
    op.drop_index("idx_transcriptions_session_created", table_name="transcriptions")
    op.drop_index("idx_transcriptions_session_id", table_name="transcriptions")
    op.drop_table("transcriptions")

    op.drop_index("idx_ws_tokens_session_id", table_name="ws_tokens")
    op.drop_index("idx_ws_tokens_expires", table_name="ws_tokens")
    op.drop_index("idx_ws_tokens_token", table_name="ws_tokens")
    op.drop_table("ws_tokens")

    op.drop_index("idx_anon_sessions_token_hash", table_name="anonymous_sessions")
    op.drop_table("anonymous_sessions")
