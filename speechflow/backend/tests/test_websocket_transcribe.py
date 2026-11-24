"""
Automated tests for the WebSocket live transcription endpoint (/api/v1/ws/transcribe).
Verifies authentication via token, heartbeat, and full streaming flow.
"""
import json
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.session.session_service import SessionService
from app.repositories.transcription_repo import TranscriptionRepository


def test_websocket_rejects_missing_or_invalid_token(sync_client):
    """Connecting without valid token must be rejected immediately."""
    with pytest.raises(Exception):
        with sync_client.websocket_connect("/api/v1/ws/transcribe?token=non_existent_token") as ws:
            pass


def test_websocket_ping_pong(sync_client):
    """Authenticated WebSocket handles ping and returns pong."""
    # 1. Create anonymous session
    res = sync_client.post("/api/v1/anonymous-session")
    assert res.status_code == 201

    # 2. Get single-use WS token
    res = sync_client.get("/api/v1/ws-token")
    assert res.status_code == 200
    ws_token = res.json()["ws_token"]

    with sync_client.websocket_connect(f"/api/v1/ws/transcribe?token={ws_token}") as ws:
        ws.send_text(json.dumps({"type": "ping"}))
        response = json.loads(ws.receive_text())
        assert response["type"] == "pong"


def test_websocket_start_and_reject_unowned_transcription(sync_client):
    """
    Attempting to start transcription for an unowned or non-existent
    transcription UUID returns TRANSCRIPTION_NOT_FOUND error event.
    """
    # 1. Create anonymous session
    res = sync_client.post("/api/v1/anonymous-session")
    assert res.status_code == 201

    # 2. Get single-use WS token
    res = sync_client.get("/api/v1/ws-token")
    assert res.status_code == 200
    ws_token = res.json()["ws_token"]

    import uuid
    fake_tx_id = str(uuid.uuid4())

    with sync_client.websocket_connect(f"/api/v1/ws/transcribe?token={ws_token}") as ws:
        ws.send_text(json.dumps({
            "type": "start",
            "transcription_id": fake_tx_id,
            "language_mode": "auto",
            "transcription_mode": "VERBATIM",
        }))
        response = json.loads(ws.receive_text())
        assert response["type"] == "error"
        assert response["code"] == "TRANSCRIPTION_NOT_FOUND"
