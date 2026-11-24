"""
Tests for database repositories: SessionRepository, WSTokenRepository, and TranscriptionRepository.
Validates ownership enforcement and boundary conditions.
"""
from datetime import datetime, timedelta, timezone
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_session_token, hash_token
from app.models.base import ensure_utc
from app.repositories.session_repo import SessionRepository
from app.repositories.ws_token_repo import WSTokenRepository
from app.repositories.transcription_repo import TranscriptionRepository


@pytest.mark.asyncio
async def test_session_repository_crud(db_session: AsyncSession):
    repo = SessionRepository(db_session)
    token = generate_session_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    # Create
    session = await repo.create(token_hash, expires_at)
    assert session.id is not None
    assert session.token_hash == token_hash

    # Get by hash
    fetched = await repo.get_by_token_hash(token_hash)
    assert fetched is not None
    assert fetched.id == session.id

    # Update last seen
    orig_seen = ensure_utc(session.last_seen_at)
    await repo.update_last_seen(session.id)
    refreshed = await repo.get_by_id(session.id)
    assert ensure_utc(refreshed.last_seen_at) >= orig_seen

    # Revoke
    await repo.revoke(session.id)
    revoked_fetched = await repo.get_by_token_hash(token_hash)
    assert revoked_fetched is None  # Active lookup filters out revoked


@pytest.mark.asyncio
async def test_ws_token_expiration(db_session: AsyncSession):
    session_repo = SessionRepository(db_session)
    ws_repo = WSTokenRepository(db_session)

    # Create parent session
    session = await session_repo.create(
        token_hash="sample_hash",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )

    # Create expired WS token
    past = datetime.now(timezone.utc) - timedelta(seconds=10)
    token = await ws_repo.create(session.id, "expired_token_123", past)

    # Attempt to consume expired token -> must return None
    consumed = await ws_repo.consume_token("expired_token_123")
    assert consumed is None


@pytest.mark.asyncio
async def test_transcription_repository_ownership_isolation(db_session: AsyncSession):
    """
    Verify strict ownership:
    User A cannot view, update, or delete User B's transcription records.
    """
    session_repo = SessionRepository(db_session)
    tx_repo = TranscriptionRepository(db_session)

    # Create two distinct anonymous sessions
    session_a = await session_repo.create("hash_user_a", datetime.now(timezone.utc) + timedelta(days=1))
    session_b = await session_repo.create("hash_user_b", datetime.now(timezone.utc) + timedelta(days=1))

    # User A creates a transcription
    tx_a = await tx_repo.create(
        anonymous_session_id=session_a.id,
        title="User A Private Notes",
        transcription_mode="VERBATIM",
        recording_status="recording",
    )
    assert tx_a.id is not None

    # User A can fetch it
    fetched_a = await tx_repo.get_by_id_and_session(tx_a.id, session_a.id)
    assert fetched_a is not None
    assert fetched_a.title == "User A Private Notes"

    # User B CANNOT fetch User A's transcription
    fetched_b = await tx_repo.get_by_id_and_session(tx_a.id, session_b.id)
    assert fetched_b is None

    # User B CANNOT update User A's transcription
    updated = await tx_repo.update(
        transcription_id=tx_a.id,
        anonymous_session_id=session_b.id,
        title="Hacked Title",
    )
    assert updated is None

    # Verify User A's title was NOT altered
    refreshed_a = await tx_repo.get_by_id_and_session(tx_a.id, session_a.id)
    assert refreshed_a.title == "User A Private Notes"

    # User B CANNOT delete User A's transcription
    deleted_b = await tx_repo.delete(tx_a.id, session_b.id)
    assert deleted_b is False

    # User A CAN delete their own transcription
    deleted_a = await tx_repo.delete(tx_a.id, session_a.id)
    assert deleted_a is True

    # Record is now gone
    assert await tx_repo.get_by_id_and_session(tx_a.id, session_a.id) is None


@pytest.mark.asyncio
async def test_transcription_pagination_and_search(db_session: AsyncSession):
    session_repo = SessionRepository(db_session)
    tx_repo = TranscriptionRepository(db_session)

    session = await session_repo.create("hash_paginated", datetime.now(timezone.utc) + timedelta(days=1))

    # Create 5 transcriptions
    for i in range(5):
        await tx_repo.create(
            anonymous_session_id=session.id,
            title=f"Meeting Recording {i}",
            recording_status="completed" if i % 2 == 0 else "draft",
        )

    # Page 1: 2 items
    items_p1, total = await tx_repo.list_by_session(session.id, offset=0, limit=2)
    assert total == 5
    assert len(items_p1) == 2

    # Search filter
    search_items, search_total = await tx_repo.list_by_session(session.id, search="Meeting Recording 3")
    assert search_total == 1
    assert search_items[0].title == "Meeting Recording 3"

    # Status filter
    completed_items, comp_total = await tx_repo.list_by_session(session.id, status="completed")
    assert comp_total == 3
    assert all(item.recording_status == "completed" for item in completed_items)
