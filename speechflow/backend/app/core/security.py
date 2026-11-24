"""
Security utilities: token generation, hashing, cookie management.
"""
import hashlib
import secrets


def generate_session_token() -> str:
    """Generate a 32-byte cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_ws_token() -> str:
    """Generate a short-lived WebSocket authentication token (UUID-like)."""
    return secrets.token_urlsafe(24)
