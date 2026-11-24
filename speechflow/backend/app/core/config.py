"""
Application configuration loaded from environment variables.
Uses Pydantic Settings for type-safe env parsing.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/speechflow"

    # Gemini
    gemini_api_key: str = ""
    gemini_live_model: str = "gemini-3.5-transcribe-live"
    gemini_api_version: str = "v1beta"

    # Session cookies
    session_cookie_name: str = "speechflow_session"
    session_ttl_days: int = 30
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # "none" in cross-origin production

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # App
    port: int = 8000
    log_level: str = "INFO"
    environment: str = "development"

    @field_validator("database_url")
    @classmethod
    def ensure_asyncpg_scheme(cls, v: str) -> str:
        """Ensure the database URL uses asyncpg driver prefix."""
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        """Return exact list of allowed CORS origins (strips trailing slashes)."""
        origins = [
            o.strip().rstrip("/")
            for o in self.frontend_origin.split(",")
            if o.strip()
        ]
        if not self.is_production:
            # Allow common local dev ports
            origins.extend([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ])
        return list(set(origins))


# Single shared instance
settings = Settings()
