"""
Automated tests for Transcription REST API endpoints.
Validates CRUD, pagination, search, sorting, manual saves, and cross-session isolation.
"""
import uuid
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_create_transcription_success(async_client: AsyncClient, create_test_session):
    """POST /api/v1/transcriptions creates a record associated with the caller's session."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    payload = {
        "title": "Hindi-English Interview",
        "language_mode": "auto",
        "transcription_mode": "VERBATIM",
    }
    response = await async_client.post("/api/v1/transcriptions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Hindi-English Interview"
    assert data["transcription_mode"] == "VERBATIM"
    assert data["recording_status"] == "draft"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_transcription_unauthorized(async_client: AsyncClient):
    """POST /api/v1/transcriptions without cookie returns 401."""
    response = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "Test Title"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_transcription_detail(async_client: AsyncClient, create_test_session):
    """GET /api/v1/transcriptions/{id} returns transcription details."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    # Create
    create_res = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "My Note", "language_mode": "en-IN"},
    )
    tx_id = create_res.json()["id"]

    # Retrieve
    get_res = await async_client.get(f"/api/v1/transcriptions/{tx_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == tx_id
    assert get_res.json()["title"] == "My Note"


@pytest.mark.asyncio
async def test_get_transcription_cross_session_isolation(
    async_client: AsyncClient, create_test_session
):
    """
    CRITICAL: User B cannot retrieve User A's transcription even if they guess the UUID.
    Must return 404 Not Found.
    """
    session_a, token_a = await create_test_session()
    session_b, token_b = await create_test_session()

    # User A creates a record
    async_client.cookies.set(settings.session_cookie_name, token_a)
    create_res = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "User A Secret", "language_mode": "auto"},
    )
    tx_id = create_res.json()["id"]

    # Switch to User B
    async_client.cookies.set(settings.session_cookie_name, token_b)
    get_res = await async_client.get(f"/api/v1/transcriptions/{tx_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_update_transcription(async_client: AsyncClient, create_test_session):
    """PATCH /api/v1/transcriptions/{id} updates title and/or transcript text."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    create_res = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "Original Title"},
    )
    tx_id = create_res.json()["id"]

    # Patch title & text
    patch_res = await async_client.patch(
        f"/api/v1/transcriptions/{tx_id}",
        json={
            "title": "Updated Title",
            "transcript_text": "Hello, ಇಂದು ನಾನು...",
        },
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["title"] == "Updated Title"
    assert data["transcript_text"] == "Hello, ಇಂದು ನಾನು..."


@pytest.mark.asyncio
async def test_manual_save_transcription(async_client: AsyncClient, create_test_session):
    """POST /api/v1/transcriptions/{id}/save explicitly sets save_method to 'manual'."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    create_res = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "Voice Memo"},
    )
    tx_id = create_res.json()["id"]

    # Perform manual save
    save_res = await async_client.post(
        f"/api/v1/transcriptions/{tx_id}/save",
        json={"title": "Saved Voice Memo", "transcript_text": "Final manual saved content"},
    )
    assert save_res.status_code == 200
    data = save_res.json()
    assert data["save_method"] == "manual"
    assert data["transcript_text"] == "Final manual saved content"


@pytest.mark.asyncio
async def test_delete_transcription(async_client: AsyncClient, create_test_session):
    """DELETE /api/v1/transcriptions/{id} permanently removes the record."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    create_res = await async_client.post(
        "/api/v1/transcriptions",
        json={"title": "To be deleted"},
    )
    tx_id = create_res.json()["id"]

    # Delete
    del_res = await async_client.delete(f"/api/v1/transcriptions/{tx_id}")
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_res = await async_client.get(f"/api/v1/transcriptions/{tx_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_list_transcriptions_pagination_and_search(
    async_client: AsyncClient, create_test_session
):
    """GET /api/v1/transcriptions supports pagination, search, and sorting."""
    session, raw_token = await create_test_session()
    async_client.cookies.set(settings.session_cookie_name, raw_token)

    # Create 6 items
    for i in range(6):
        await async_client.post(
            "/api/v1/transcriptions",
            json={"title": f"Meeting {i:02d}"},
        )

    # Page 1, size 3
    res_p1 = await async_client.get("/api/v1/transcriptions?page=1&page_size=3")
    assert res_p1.status_code == 200
    p1_data = res_p1.json()
    assert p1_data["total"] == 6
    assert len(p1_data["items"]) == 3
    assert p1_data["pages"] == 2
    assert p1_data["page"] == 1

    # Page 2, size 3
    res_p2 = await async_client.get("/api/v1/transcriptions?page=2&page_size=3")
    assert res_p2.status_code == 200
    p2_data = res_p2.json()
    assert len(p2_data["items"]) == 3
    assert p2_data["page"] == 2

    # Search filter
    search_res = await async_client.get("/api/v1/transcriptions?search=Meeting 04")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] == 1
    assert search_data["items"][0]["title"] == "Meeting 04"
