"""
Structured logging configuration.
"""
import logging
import sys
from app.core.config import settings


def setup_logging() -> None:
    """Configure application logging."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Quiet noisy libraries in production
    if settings.is_production:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging configured at level %s (env=%s)",
        settings.log_level,
        settings.environment,
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
