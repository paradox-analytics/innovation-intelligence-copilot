from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import setup_logging
from app.core.middleware import (
    RequestIDMiddleware,
    StructuredLoggingMiddleware,
    TimingMiddleware,
)
from app.core.neo4j_client import neo4j_client
from app.core.openapi import custom_openapi
from app.core.startup import validate_environment
from app.core.tasks import get_task_queue

# Configure structured logging before anything else
setup_logging(
    environment=settings.ENVIRONMENT,
    log_level=settings.LOG_LEVEL,
)

logger = logging.getLogger(__name__)

# Background worker task handle
_worker_task: asyncio.Task[None] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown of database connections and workers."""
    global _worker_task  # noqa: PLW0603

    # Validate environment configuration
    validate_environment()

    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized.")

    logger.info("Connecting to Neo4j...")
    try:
        await neo4j_client.connect()
        logger.info("Neo4j connected.")
    except Exception as exc:
        logger.warning("Neo4j connection failed (non-fatal): %s", exc)

    # Start background task worker
    task_queue = get_task_queue()
    _worker_task = asyncio.create_task(task_queue.start_worker())
    logger.info("Background task worker started.")

    yield

    # Shutdown
    logger.info("Stopping background task worker...")
    await task_queue.stop_worker()
    if _worker_task is not None:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    await task_queue.close()

    logger.info("Closing database connections...")
    await close_db()
    await neo4j_client.close()
    logger.info("All connections closed.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered multi-agent platform for enterprise technology advisory. "
        "Provides strategic analysis, document intelligence, knowledge graph exploration, "
        "and executive report generation."
    ),
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

register_exception_handlers(app)

# ---------------------------------------------------------------------------
# Middleware (order matters — outermost first)
# ---------------------------------------------------------------------------

app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(TimingMiddleware)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(api_router)

# ---------------------------------------------------------------------------
# Custom OpenAPI schema
# ---------------------------------------------------------------------------

app.openapi = lambda: custom_openapi(app)  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Root health check (legacy / simple)
# ---------------------------------------------------------------------------


@app.get("/api/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
