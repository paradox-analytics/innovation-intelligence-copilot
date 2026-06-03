from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analysis,
    auth,
    documents,
    health,
    knowledge,
    metrics,
    reports,
    streaming,
    webhooks,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(analysis.router)
api_router.include_router(documents.router)
api_router.include_router(knowledge.router)
api_router.include_router(reports.router)
api_router.include_router(health.router)
api_router.include_router(metrics.router)
api_router.include_router(streaming.router)
api_router.include_router(webhooks.router)
