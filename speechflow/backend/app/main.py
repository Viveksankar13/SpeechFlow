"""
FastAPI application factory and main entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("SpeechFlow backend starting (env=%s)", settings.environment)

    # Verify DB connectivity on startup & create tables if they do not exist
    try:
        from app.database.engine import engine
        from app.models.base import Base
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database connection and schema verified.")
    except Exception as exc:
        logger.error("Database connection failed on startup: %s", exc)
        # Don't crash on startup — let health endpoint report the error

    yield

    logger.info("SpeechFlow backend shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SpeechFlow API",
        description="Real-time multilingual speech-to-text backend.",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,  # Required for HttpOnly cookies
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Global exception handler ---
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logging.getLogger(__name__).exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
        )

    # --- Routers ---
    @app.get("/", tags=["Health"])
    async def root():
        """Root endpoint — confirms API is running."""
        return {
            "status": "ok",
            "service": "SpeechFlow API",
            "docs": "/docs",
            "health": "/health/ready",
        }

    app.include_router(api_v1_router)

    return app


app = create_app()
