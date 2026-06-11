from __future__ import annotations

import io
import json
import logging
from uuid import uuid4

import pypdf
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.neo4j_client import neo4j_client
from app.graph.entity_extractor import extract_entities
from app.graph.service import KnowledgeGraphService
from app.rag.chunker import chunk_text
from app.rag.embeddings import embed_batch

logger = logging.getLogger(__name__)


async def ingest_pdf(
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
    metadata: dict[str, object] | None = None,
) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            pages.append(extracted)

    full_text = "\n\n".join(pages)
    return await _ingest_text(full_text, filename, db, metadata)


async def ingest_text(
    content: str,
    filename: str,
    db: AsyncSession,
    metadata: dict[str, object] | None = None,
) -> str:
    return await _ingest_text(content, filename, db, metadata)


async def _ingest_text(
    content: str,
    title: str,
    db: AsyncSession,
    metadata: dict[str, object] | None = None,
) -> str:
    document_id = uuid4().hex
    meta = metadata or {}

    # 1. Chunk
    chunks = chunk_text(content, metadata={"document_id": document_id, "title": title})
    logger.info("Document %s: %d chunks created", document_id, len(chunks))

    # 2. Embed
    contents = [c.content for c in chunks]
    embeddings = await embed_batch(contents)

    # 3. Store document record
    await db.execute(
        text("""
            INSERT INTO documents (id, title, content, doc_type, metadata, created_at, updated_at)
            VALUES (:id, :title, :content, 'PDF', CAST(:metadata AS jsonb), NOW(), NOW())
        """),
        {
            "id": document_id,
            "title": title,
            "content": content[:50000],  # Store first 50k chars as content preview
            "metadata": json.dumps(meta),
        },
    )

    # 4. Store chunks with embeddings
    for chunk, embedding in zip(chunks, embeddings):
        await db.execute(
            text("""
                INSERT INTO document_chunks (id, document_id, content, embedding, chunk_index, metadata)
                VALUES (:id, :document_id, :content, CAST(:embedding AS vector), :chunk_index, CAST(:metadata AS jsonb))
            """),
            {
                "id": chunk.id,
                "document_id": document_id,
                "content": chunk.content,
                "embedding": str(embedding),
                "chunk_index": chunk.chunk_index,
                "metadata": json.dumps(chunk.metadata),
            },
        )

    await db.flush()
    logger.info("Document %s: stored in database", document_id)

    # 5. Extract entities for knowledge graph (best-effort, non-fatal)
    try:
        extraction_text = content[:8000]
        entities, relationships = await extract_entities(
            extraction_text, document_id=document_id
        )

        graph_service = KnowledgeGraphService(neo4j_client)
        for entity in entities:
            await graph_service.upsert_entity(entity)
        for rel in relationships:
            await graph_service.upsert_relationship(rel)

        logger.info(
            "Document %s: %d entities, %d relationships extracted",
            document_id,
            len(entities),
            len(relationships),
        )
    except Exception:
        logger.exception(
            "Document %s: entity extraction failed (non-fatal)", document_id
        )

    return document_id
