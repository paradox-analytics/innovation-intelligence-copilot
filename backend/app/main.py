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


async def _handle_document_ingestion(payload: dict[str, object]) -> dict[str, object]:
    """Chunk, embed, and extract entities from an uploaded document."""
    import json

    from app.core.database import async_session_factory
    from app.core.neo4j_client import neo4j_client
    from app.graph.entity_extractor import extract_entities
    from app.graph.service import KnowledgeGraphService
    from app.rag.chunker import chunk_text
    from app.rag.embeddings import embed_batch

    document_id = str(payload["document_id"])
    title = str(payload["title"])
    content = str(payload["content"])

    logger.info("ingestion_started document_id=%s title=%s", document_id, title[:60])

    try:
        chunks = chunk_text(content, metadata={"document_id": document_id, "title": title})
        logger.info("ingestion_chunked document_id=%s chunks=%d", document_id, len(chunks))

        contents = [c.content for c in chunks]
        embeddings = await embed_batch(contents)
        logger.info("ingestion_embedded document_id=%s", document_id)

        async with async_session_factory() as db:
            from sqlalchemy import text as sql_text
            for chunk, embedding in zip(chunks, embeddings):
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                await db.execute(
                    sql_text(
                        "INSERT INTO document_chunks (id, document_id, content, embedding, chunk_index, metadata) "
                        "VALUES (:id, :doc_id, :content, cast(:emb as vector), :idx, cast(:meta as jsonb))"
                    ),
                    {
                        "id": chunk.id,
                        "doc_id": document_id,
                        "content": chunk.content,
                        "emb": embedding_str,
                        "idx": chunk.chunk_index,
                        "meta": json.dumps(chunk.metadata),
                    },
                )
            await db.commit()

        logger.info("ingestion_stored document_id=%s chunks=%d", document_id, len(chunks))

        # Entity extraction for knowledge graph (best-effort)
        try:
            entities, relationships = await extract_entities(
                content[:8000], document_id=document_id
            )
            graph_service = KnowledgeGraphService(neo4j_client)
            for entity in entities:
                await graph_service.upsert_entity(entity)
            for rel in relationships:
                await graph_service.upsert_relationship(rel)
            logger.info(
                "ingestion_entities document_id=%s entities=%d relationships=%d",
                document_id, len(entities), len(relationships),
            )
        except Exception:
            logger.exception("ingestion_entity_extraction_failed document_id=%s", document_id)

        return {"status": "completed", "document_id": document_id, "chunks": len(chunks)}

    except Exception as exc:
        logger.exception("ingestion_failed document_id=%s", document_id)
        raise


async def _handle_analysis_task(payload: dict[str, object]) -> dict[str, object]:
    """Run the multi-agent analysis pipeline and persist results."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.agents.orchestrator import run_analysis
    from app.core.database import async_session_factory
    from app.models.analysis import AnalysisRequest, AnalysisStatus

    analysis_id = str(payload["analysis_id"])
    query = str(payload["query"])

    logger.info("analysis_started analysis_id=%s query=%s", analysis_id, query[:80])

    async with async_session_factory() as db:
        # Mark as processing
        result = await db.execute(
            select(AnalysisRequest).where(AnalysisRequest.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis is None:
            logger.error("analysis_not_found analysis_id=%s", analysis_id)
            return {"error": "Analysis not found"}

        analysis.status = AnalysisStatus.PROCESSING
        await db.commit()

        try:
            analysis_result = await run_analysis(query=query)

            # Persist results
            analysis.status = AnalysisStatus.COMPLETED
            analysis.confidence_score = analysis_result.confidence_score
            from dataclasses import asdict
            analysis.result = asdict(analysis_result)
            analysis.completed_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info(
                "analysis_completed analysis_id=%s confidence=%.1f",
                analysis_id,
                analysis_result.confidence_score,
            )
            return {"status": "completed", "analysis_id": analysis_id}

        except Exception as exc:
            analysis.status = AnalysisStatus.FAILED
            analysis.result = {"error": str(exc)}
            analysis.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.exception("analysis_failed analysis_id=%s", analysis_id)
            raise


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

    # Register task handlers and start background task worker
    task_queue = get_task_queue()
    task_queue.register("analysis", _handle_analysis_task)
    task_queue.register("document_ingestion", _handle_document_ingestion)
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
