from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tasks import enqueue_analysis
from app.models.analysis import AnalysisRequest, AnalysisStatus

router = APIRouter(prefix="/analyze", tags=["analysis"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AnalysisSubmitRequest(BaseModel):
    query: str = Field(..., min_length=10, max_length=4000, description="Strategic question to analyze")
    context: dict[str, object] | None = Field(default=None, description="Optional context for the analysis")


class AnalysisSubmitResponse(BaseModel):
    analysis_id: str
    status: str


class AnalysisResultResponse(BaseModel):
    id: str
    query: str
    status: str
    result: dict[str, object] | None = None
    confidence_score: float | None = None
    created_at: datetime
    completed_at: datetime | None = None


class AnalysisStatusResponse(BaseModel):
    id: str
    status: str
    created_at: datetime
    completed_at: datetime | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=dict[str, AnalysisSubmitResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a strategic analysis question",
)
async def submit_analysis(
    body: AnalysisSubmitRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, AnalysisSubmitResponse]:
    analysis = AnalysisRequest(
        id=uuid4().hex,
        query=body.query,
        status=AnalysisStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(analysis)
    await db.commit()

    await enqueue_analysis(
        analysis_id=analysis.id,
        query=body.query,
        context=body.context or {},
    )

    return {
        "data": AnalysisSubmitResponse(
            analysis_id=analysis.id,
            status=analysis.status.value,
        )
    }


@router.get(
    "/{analysis_id}",
    response_model=dict[str, AnalysisResultResponse],
    summary="Get analysis result",
)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, AnalysisResultResponse]:
    result = await db.execute(
        select(AnalysisRequest).where(AnalysisRequest.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {analysis_id} not found",
        )

    return {
        "data": AnalysisResultResponse(
            id=analysis.id,
            query=analysis.query,
            status=analysis.status.value,
            result=analysis.result,
            confidence_score=analysis.confidence_score,
            created_at=analysis.created_at,
            completed_at=analysis.completed_at,
        )
    }


@router.get(
    "/{analysis_id}/status",
    response_model=dict[str, AnalysisStatusResponse],
    summary="Get analysis processing status",
)
async def get_analysis_status(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, AnalysisStatusResponse]:
    result = await db.execute(
        select(AnalysisRequest).where(AnalysisRequest.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {analysis_id} not found",
        )

    return {
        "data": AnalysisStatusResponse(
            id=analysis.id,
            status=analysis.status.value,
            created_at=analysis.created_at,
            completed_at=analysis.completed_at,
        )
    }
