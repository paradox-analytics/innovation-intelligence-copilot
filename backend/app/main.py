from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown of database connections."""
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

    yield

    # Shutdown
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
# Middleware
# ---------------------------------------------------------------------------

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
# Health check
# ---------------------------------------------------------------------------


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
