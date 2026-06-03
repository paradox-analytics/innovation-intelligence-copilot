from __future__ import annotations

from fastapi import APIRouter, HTTPException, Security, status
from fastapi.responses import PlainTextResponse
from fastapi.security import APIKeyHeader

from app.core.config import settings
from app.core.metrics import metrics

router = APIRouter(tags=["system"])

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def _verify_admin_key(
    api_key: str | None = Security(_admin_key_header),
) -> str:
    """Validate that the caller has provided the admin API key."""
    if not api_key or api_key != settings.SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin API key",
        )
    return api_key


@router.get(
    "/metrics",
    summary="Prometheus-compatible metrics",
    description=(
        "Returns application metrics in Prometheus text exposition format. "
        "Protected by admin API key (X-Admin-Key header)."
    ),
    response_class=PlainTextResponse,
)
async def get_metrics(
    _key: str = Security(_verify_admin_key),
) -> PlainTextResponse:
    body = metrics.render_prometheus()
    return PlainTextResponse(
        content=body,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
