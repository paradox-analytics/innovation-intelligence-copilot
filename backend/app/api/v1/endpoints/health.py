from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import engine
from app.core.neo4j_client import neo4j_client

router = APIRouter(prefix="/health", tags=["system"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class ServiceCheck(BaseModel):
    status: Literal["healthy", "unhealthy"]
    latency_ms: float
    error: str | None = None


class ReadinessResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    checks: dict[str, ServiceCheck]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _check_postgres() -> ServiceCheck:
    """Verify PostgreSQL connectivity with a simple query."""
    import sqlalchemy

    start = time.monotonic()
    try:
        async with engine.connect() as conn:
            await conn.execute(sqlalchemy.text("SELECT 1"))
        elapsed = (time.monotonic() - start) * 1000
        return ServiceCheck(status="healthy", latency_ms=round(elapsed, 2))
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        return ServiceCheck(
            status="unhealthy",
            latency_ms=round(elapsed, 2),
            error=str(exc),
        )


async def _check_neo4j() -> ServiceCheck:
    """Verify Neo4j connectivity."""
    start = time.monotonic()
    try:
        if neo4j_client._driver is None:
            raise RuntimeError("Neo4j driver not initialised")
        await neo4j_client.driver.verify_connectivity()
        elapsed = (time.monotonic() - start) * 1000
        return ServiceCheck(status="healthy", latency_ms=round(elapsed, 2))
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        return ServiceCheck(
            status="unhealthy",
            latency_ms=round(elapsed, 2),
            error=str(exc),
        )


async def _check_redis() -> ServiceCheck:
    """Verify Redis connectivity with a PING."""
    import redis.asyncio as aioredis

    start = time.monotonic()
    try:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            pong = await client.ping()
            elapsed = (time.monotonic() - start) * 1000
            if not pong:
                return ServiceCheck(
                    status="unhealthy",
                    latency_ms=round(elapsed, 2),
                    error="PING did not return True",
                )
            return ServiceCheck(status="healthy", latency_ms=round(elapsed, 2))
        finally:
            await client.aclose()
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        return ServiceCheck(
            status="unhealthy",
            latency_ms=round(elapsed, 2),
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    summary="Liveness probe",
    description="Returns 200 if the application process is running. "
    "Use this for Kubernetes liveness probes or load-balancer health checks.",
    response_model=dict[str, str],
)
async def liveness() -> dict[str, str]:
    return {"status": "alive"}


@router.get(
    "/ready",
    summary="Readiness probe",
    description=(
        "Checks connectivity to all backing services (PostgreSQL, Neo4j, Redis) "
        "and returns an aggregate status with per-service latency."
    ),
    response_model=ReadinessResponse,
)
async def readiness() -> ReadinessResponse:
    postgres = await _check_postgres()
    neo4j = await _check_neo4j()
    redis = await _check_redis()

    checks = {
        "postgres": postgres,
        "neo4j": neo4j,
        "redis": redis,
    }

    unhealthy_count = sum(1 for c in checks.values() if c.status == "unhealthy")

    if unhealthy_count == 0:
        overall: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    elif unhealthy_count < len(checks):
        overall = "degraded"
    else:
        overall = "unhealthy"

    return ReadinessResponse(status=overall, checks=checks)
