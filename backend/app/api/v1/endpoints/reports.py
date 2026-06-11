from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.analysis import AnalysisRequest, AnalysisStatus

router = APIRouter(prefix="/reports", tags=["reports"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ReportGenerateRequest(BaseModel):
    analysis_id: str = Field(
        ..., description="ID of the completed analysis to generate report from"
    )
    format: str = Field(
        default="executive", description="Report format: executive, technical, or briefing"
    )
    include_appendix: bool = Field(
        default=True, description="Whether to include supporting evidence appendix"
    )


class ReportMetadata(BaseModel):
    id: str
    analysis_id: str
    format: str
    generated_at: datetime


class ReportResponse(BaseModel):
    metadata: ReportMetadata
    title: str
    executive_summary: str
    sections: list[dict[str, object]]
    confidence_score: float | None = None


class ReportMarkdown(BaseModel):
    metadata: ReportMetadata
    content: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_report_sections(
    analysis: AnalysisRequest,
    report_format: str,
    include_appendix: bool,
) -> list[dict[str, object]]:
    """Build report sections from analysis result."""
    result: dict[str, object] = analysis.result or {}
    sections: list[dict[str, object]] = []

    sections.append(
        {
            "heading": "Strategic Question",
            "content": analysis.query,
        }
    )

    if "recommendation" in result:
        sections.append(
            {
                "heading": "Recommendation",
                "content": result["recommendation"],
            }
        )

    if "supporting_evidence" in result:
        sections.append(
            {
                "heading": "Supporting Evidence",
                "content": result["supporting_evidence"],
            }
        )

    if "contrarian_evidence" in result:
        sections.append(
            {
                "heading": "Contrarian Perspectives",
                "content": result["contrarian_evidence"],
            }
        )

    if "risks" in result:
        sections.append(
            {
                "heading": "Risk Assessment",
                "content": result["risks"],
            }
        )

    if "technology_signals" in result:
        sections.append(
            {
                "heading": "Technology Signals",
                "content": result["technology_signals"],
            }
        )

    if include_appendix and "key_assumptions" in result:
        sections.append(
            {
                "heading": "Appendix: Key Assumptions",
                "content": result["key_assumptions"],
            }
        )

    return sections


def _render_markdown(
    title: str, sections: list[dict[str, object]], confidence: float | None
) -> str:
    """Render report sections as markdown."""
    lines: list[str] = [f"# {title}", ""]

    if confidence is not None:
        lines.append(f"**Confidence Score:** {confidence:.0%}")
        lines.append("")

    for section in sections:
        lines.append(f"## {section['heading']}")
        lines.append("")
        content = section.get("content", "")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    for key, value in item.items():
                        lines.append(f"- **{key}:** {value}")
                else:
                    lines.append(f"- {item}")
        elif isinstance(content, dict):
            for key, value in content.items():
                lines.append(f"- **{key}:** {value}")
        else:
            lines.append(str(content))
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/generate",
    response_model=dict[str, ReportResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate an executive report from a completed analysis",
)
async def generate_report(
    body: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, ReportResponse]:
    result = await db.execute(select(AnalysisRequest).where(AnalysisRequest.id == body.analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {body.analysis_id} not found",
        )

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Analysis is not completed (current status: {analysis.status.value}). "
            "Only completed analyses can generate reports.",
        )

    report_id = uuid4().hex
    now = datetime.now(UTC)

    analysis_result: dict[str, object] = analysis.result or {}
    executive_summary = str(analysis_result.get("executive_summary", analysis.query))
    title = f"Innovation Intelligence Report: {analysis.query[:80]}"

    sections = _build_report_sections(analysis, body.format, body.include_appendix)

    metadata = ReportMetadata(
        id=report_id,
        analysis_id=analysis.id,
        format=body.format,
        generated_at=now,
    )

    return {
        "data": ReportResponse(
            metadata=metadata,
            title=title,
            executive_summary=executive_summary,
            sections=sections,
            confidence_score=analysis.confidence_score,
        )
    }


@router.get(
    "/{report_id}",
    summary="Get report (JSON or Markdown via Accept header)",
)
async def get_report(
    report_id: str,
    request: Request,
    analysis_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, ReportResponse | ReportMarkdown]:
    # In a production system, reports would be persisted.
    # For now, regenerate from the associated analysis.
    if analysis_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analysis_id query parameter is required to retrieve a report",
        )

    result = await db.execute(select(AnalysisRequest).where(AnalysisRequest.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {analysis_id} not found",
        )

    title = f"Innovation Intelligence Report: {analysis.query[:80]}"
    sections = _build_report_sections(analysis, "executive", True)
    now = datetime.now(UTC)

    metadata = ReportMetadata(
        id=report_id,
        analysis_id=analysis.id,
        format="executive",
        generated_at=now,
    )

    accept = request.headers.get("accept", "application/json")

    if "text/markdown" in accept:
        markdown_content = _render_markdown(title, sections, analysis.confidence_score)
        return {
            "data": ReportMarkdown(
                metadata=metadata,
                content=markdown_content,
            )
        }

    return {
        "data": ReportResponse(
            metadata=metadata,
            title=title,
            executive_summary=str((analysis.result or {}).get("executive_summary", analysis.query)),
            sections=sections,
            confidence_score=analysis.confidence_score,
        )
    }
