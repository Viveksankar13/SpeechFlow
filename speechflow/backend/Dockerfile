# ---- Backend Dockerfile ----
# Multi-stage build: builder (installs deps) → runner (minimal runtime)

# Stage 1: Builder — install Python dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system dependencies needed for asyncpg / cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create venv and install dependencies
COPY requirements.txt .
RUN python -m venv /venv && \
    /venv/bin/pip install --upgrade pip && \
    /venv/bin/pip install --no-cache-dir -r requirements.txt


# Stage 2: Runner — minimal production image
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime-only system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy venv from builder
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy application source
COPY . .

# Non-root user for security
RUN useradd --no-create-home --shell /bin/false appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose default port (overridden by PORT env var in production)
EXPOSE 8000

# Start Uvicorn — PORT env var is used by Render
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
