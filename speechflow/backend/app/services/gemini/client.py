"""
Gemini client factory and configuration.
"""
from google import genai
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_gemini_client() -> genai.Client:
    """Initialize and return the official Google Gen AI SDK client."""
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. Real Gemini streaming will fail if invoked.")
    return genai.Client(
        api_key=api_key or "DUMMY_KEY_FOR_INIT",
        http_options={"api_version": settings.gemini_api_version},
    )
