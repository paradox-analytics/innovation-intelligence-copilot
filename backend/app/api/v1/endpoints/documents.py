from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.document import DocType, Document

router = APIRouter(prefix="/documents", tags=["documents"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class DocumentResponse(BaseModel):
    id: str
    title: str
    source_url: str | None = None
    doc_type: str
    metadata: dict[str, object] | None = None
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentResponse):
    content: str


class DocumentListResponse(BaseModel):
    data: list[DocumentResponse]
    total: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=dict[str, DocumentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
)
async def upload_document(
    file: UploadFile,
    title: str = Query(..., min_length=1, max_length=512),
    doc_type: DocType = Query(default=DocType.PDF),
    source_url: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, DocumentResponse]:
    content_bytes = await file.read()
    content = content_bytes.decode("utf-8", errors="replace")

    now = datetime.now(timezone.utc)
    document = Document(
        id=uuid4().hex,
        title=title,
        content=content,
        source_url=source_url,
        doc_type=doc_type,
        metadata_={
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(content_bytes),
        },
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    await db.commit()

    # Trigger background ingestion (chunking + embedding + entity extraction)
    try:
        from app.core.tasks import get_task_queue
        queue = get_task_queue()
        await queue.enqueue(
            task_type="document_ingestion",
            payload={
                "document_id": document.id,
                "title": title,
                "content": content[:50000],
            },
        )
    except Exception:
        import asyncio
        from app.main import _handle_document_ingestion
        asyncio.create_task(
            _handle_document_ingestion({
                "document_id": document.id,
                "title": title,
                "content": content[:50000],
            })
        )

    return {
        "data": DocumentResponse(
            id=document.id,
            title=document.title,
            source_url=document.source_url,
            doc_type=document.doc_type.value,
            metadata=document.metadata_,
            created_at=document.created_at,
            updated_at=document.updated_at,
        )
    }


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List documents with pagination",
)
async def list_documents(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    doc_type: DocType | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    query = select(Document)
    count_query = select(func.count(Document.id))

    if doc_type is not None:
        query = query.where(Document.doc_type == doc_type)
        count_query = count_query.where(Document.doc_type == doc_type)

    query = query.order_by(Document.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    return DocumentListResponse(
        data=[
            DocumentResponse(
                id=doc.id,
                title=doc.title,
                source_url=doc.source_url,
                doc_type=doc.doc_type.value,
                metadata=doc.metadata_,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
            )
            for doc in documents
        ],
        total=total,
    )


@router.get(
    "/{document_id}",
    response_model=dict[str, DocumentDetailResponse],
    summary="Get document detail",
)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, DocumentDetailResponse]:
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    return {
        "data": DocumentDetailResponse(
            id=document.id,
            title=document.title,
            content=document.content,
            source_url=document.source_url,
            doc_type=document.doc_type.value,
            metadata=document.metadata_,
            created_at=document.created_at,
            updated_at=document.updated_at,
        )
    }


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    await db.delete(document)
    await db.flush()
