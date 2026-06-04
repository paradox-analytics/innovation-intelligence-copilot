# =============================================================================
# Innovation Intelligence Copilot — Backend
# Python 3.12 + FastAPI + Poetry
# =============================================================================

FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System dependencies required for asyncpg, cryptography, etc.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Install Poetry
# ---------------------------------------------------------------------------
ENV POETRY_VERSION=1.8.4 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

# ---------------------------------------------------------------------------
# Install dependencies (cached layer)
# ---------------------------------------------------------------------------
WORKDIR /app

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-root && \
    rm -rf /root/.cache

# ---------------------------------------------------------------------------
# Copy application code
# ---------------------------------------------------------------------------
COPY backend/ ./backend/

# Install the project itself
RUN poetry install --only main

# Set PYTHONPATH so the app module is importable
ENV PYTHONPATH="/app:$PYTHONPATH"

# ---------------------------------------------------------------------------
# Runtime — PORT is provided by Railway at deploy time
# ---------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

CMD ["sh", "-c", "poetry run uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 4 --loop uvloop --http httptools"]
