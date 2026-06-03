from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import analysis, documents, knowledge, reports

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(analysis.router)
api_router.include_router(documents.router)
api_router.include_router(knowledge.router)
api_router.include_router(reports.router)
