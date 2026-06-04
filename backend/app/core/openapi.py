from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


def custom_openapi(app: FastAPI) -> dict[str, object]:
    """Generate a customised OpenAPI schema with detailed descriptions,
    security schemes, server entries, and tag metadata.

    Called once and cached on ``app.openapi_schema``.
    """
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi

    schema = get_openapi(
        title="Innovation Intelligence Copilot API",
        version="0.1.0",
        description=(
            "AI-powered multi-agent platform for enterprise technology advisory.\n\n"
            "## Capabilities\n"
            "- **Strategic Analysis** -- submit complex technology questions and receive "
            "multi-agent analysis with confidence scoring.\n"
            "- **Document Intelligence** -- ingest PDFs, patents, and reports; "
            "automatically chunk, embed, and index for RAG retrieval.\n"
            "- **Knowledge Graph** -- explore entities, relationships, and technology "
            "signals extracted from ingested documents via Neo4j.\n"
            "- **Executive Reports** -- generate publication-ready reports from "
            "completed analyses.\n\n"
            "## Authentication\n"
            "All protected endpoints accept **either**:\n"
            "1. `Authorization: Bearer <JWT>` -- obtained via `/api/v1/auth/login`\n"
            "2. `X-API-Key: <key>` -- generated via `/api/v1/auth/api-key`\n"
        ),
        routes=app.routes,
    )

    # ------------------------------------------------------------------
    # Servers
    # ------------------------------------------------------------------
    schema["servers"] = [
        {
            "url": "http://localhost:8000",
            "description": "Local development",
        },
        {
            "url": "https://staging-api.innovationintel.io",
            "description": "Staging",
        },
        {
            "url": "https://api.innovationintel.io",
            "description": "Production",
        },
    ]

    # ------------------------------------------------------------------
    # Security schemes
    # ------------------------------------------------------------------
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerJWT": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token obtained from POST /api/v1/auth/login",
        },
        "APIKey": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key generated via POST /api/v1/auth/api-key",
        },
        "AdminKey": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Admin-Key",
            "description": "Admin key for system endpoints (metrics, etc.)",
        },
    }

    # Global security (both options)
    schema["security"] = [
        {"BearerJWT": []},
        {"APIKey": []},
    ]

    # ------------------------------------------------------------------
    # Tags
    # ------------------------------------------------------------------
    schema["tags"] = [
        {
            "name": "analysis",
            "description": "Submit strategic questions and retrieve multi-agent analysis results.",
        },
        {
            "name": "documents",
            "description": "Upload, list, retrieve, and delete documents for RAG indexing.",
        },
        {
            "name": "knowledge",
            "description": "Explore the knowledge graph: entities, relationships, and technology signals.",
        },
        {
            "name": "reports",
            "description": "Generate executive reports from completed analyses.",
        },
        {
            "name": "auth",
            "description": "User registration, login, and API key management.",
        },
        {
            "name": "system",
            "description": "Health checks, readiness probes, and application metrics.",
        },
    ]

    # ------------------------------------------------------------------
    # Example request / response bodies for key endpoints
    # ------------------------------------------------------------------
    paths: dict[str, object] = schema.get("paths", {})

    _patch_analysis_examples(paths)
    _patch_auth_examples(paths)
    _patch_document_examples(paths)
    _patch_report_examples(paths)

    app.openapi_schema = schema
    return schema


# ---------------------------------------------------------------------------
# Per-endpoint example helpers
# ---------------------------------------------------------------------------


def _patch_analysis_examples(paths: dict[str, object]) -> None:
    post_op = _get_operation(paths, "/api/v1/analyze", "post")
    if post_op is not None:
        post_op.setdefault("requestBody", {}).setdefault("content", {}).setdefault(
            "application/json", {}
        )["example"] = {
            "query": "What is the competitive landscape for solid-state battery technology in 2025?",
            "context": {"industry": "energy_storage", "region": "global"},
        }

    get_op = _get_operation(paths, "/api/v1/analyze/{analysis_id}", "get")
    if get_op is not None:
        _set_response_example(
            get_op,
            200,
            {
                "data": {
                    "id": "a1b2c3d4e5f6",
                    "query": "What is the competitive landscape for solid-state battery technology?",
                    "status": "COMPLETED",
                    "result": {
                        "executive_summary": "Solid-state batteries are approaching commercialisation...",
                        "recommendation": "Invest in sulfide-based electrolyte startups.",
                    },
                    "confidence_score": 0.87,
                    "created_at": "2025-06-01T12:00:00Z",
                    "completed_at": "2025-06-01T12:03:45Z",
                }
            },
        )


def _patch_auth_examples(paths: dict[str, object]) -> None:
    login_op = _get_operation(paths, "/api/v1/auth/login", "post")
    if login_op is not None:
        login_op.setdefault("requestBody", {}).setdefault("content", {}).setdefault(
            "application/json", {}
        )["example"] = {
            "email": "analyst@example.com",
            "password": "securepassword123",
        }

    register_op = _get_operation(paths, "/api/v1/auth/register", "post")
    if register_op is not None:
        register_op.setdefault("requestBody", {}).setdefault("content", {}).setdefault(
            "application/json", {}
        )["example"] = {
            "email": "newuser@example.com",
            "password": "strongP@ssw0rd!",
            "full_name": "Jane Doe",
        }


def _patch_document_examples(paths: dict[str, object]) -> None:
    list_op = _get_operation(paths, "/api/v1/documents", "get")
    if list_op is not None:
        _set_response_example(
            list_op,
            200,
            {
                "data": [
                    {
                        "id": "doc123",
                        "title": "Solid-State Battery Technology Report 2025",
                        "source_url": "https://example.com/report.pdf",
                        "doc_type": "REPORT",
                        "metadata": {"size_bytes": 245000},
                        "created_at": "2025-05-15T10:00:00Z",
                        "updated_at": "2025-05-15T10:00:00Z",
                    }
                ],
                "total": 1,
            },
        )


def _patch_report_examples(paths: dict[str, object]) -> None:
    gen_op = _get_operation(paths, "/api/v1/reports/generate", "post")
    if gen_op is not None:
        gen_op.setdefault("requestBody", {}).setdefault("content", {}).setdefault(
            "application/json", {}
        )["example"] = {
            "analysis_id": "a1b2c3d4e5f6",
            "format": "executive",
            "include_appendix": True,
        }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def _get_operation(
    paths: dict[str, object],
    path: str,
    method: str,
) -> dict[str, object] | None:
    path_item = paths.get(path)
    if not isinstance(path_item, dict):
        return None
    op = path_item.get(method)
    if not isinstance(op, dict):
        return None
    return op


def _set_response_example(
    operation: dict[str, object],
    status_code: int,
    example: object,
) -> None:
    responses = operation.setdefault("responses", {})
    if not isinstance(responses, dict):
        return
    resp = responses.get(str(status_code))
    if not isinstance(resp, dict):
        return
    content = resp.setdefault("content", {})
    if not isinstance(content, dict):
        return
    json_content = content.setdefault("application/json", {})
    if isinstance(json_content, dict):
        json_content["example"] = example
