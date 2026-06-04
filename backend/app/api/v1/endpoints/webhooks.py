"""Webhook management endpoints and delivery logic."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.webhook import Webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

logger = logging.getLogger(__name__)

_DELIVERY_TIMEOUT_SECONDS = 10


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class WebhookCreateRequest(BaseModel):
    url: str = Field(..., description="URL to receive webhook POST requests")
    events: list[str] = Field(
        default=["analysis.completed"],
        description="Event types to subscribe to",
    )


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    secret: str
    is_active: bool
    created_at: datetime


class WebhookListResponse(BaseModel):
    data: list[WebhookResponse]
    total: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=dict[str, WebhookResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a webhook",
)
async def create_webhook(
    body: WebhookCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, WebhookResponse]:
    """Register a webhook URL to receive analysis completion events."""
    webhook = Webhook(
        id=uuid4().hex,
        url=body.url,
        events=body.events,
        secret=secrets.token_urlsafe(32),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(webhook)
    await db.flush()

    return {
        "data": WebhookResponse(
            id=webhook.id,
            url=webhook.url,
            events=webhook.events,
            secret=webhook.secret,
            is_active=webhook.is_active,
            created_at=webhook.created_at,
        )
    }


@router.get(
    "",
    response_model=WebhookListResponse,
    summary="List registered webhooks",
)
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
) -> WebhookListResponse:
    """List all registered webhooks."""
    result = await db.execute(
        select(Webhook).where(Webhook.is_active.is_(True)).order_by(Webhook.created_at.desc())
    )
    webhooks = result.scalars().all()

    items = [
        WebhookResponse(
            id=wh.id,
            url=wh.url,
            events=wh.events,
            secret=wh.secret,
            is_active=wh.is_active,
            created_at=wh.created_at,
        )
        for wh in webhooks
    ]

    return WebhookListResponse(data=items, total=len(items))


@router.delete(
    "/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a webhook",
)
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a registered webhook."""
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    if webhook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook {webhook_id} not found",
        )

    await db.execute(delete(Webhook).where(Webhook.id == webhook_id))
    await db.flush()


# ---------------------------------------------------------------------------
# Internal: webhook delivery
# ---------------------------------------------------------------------------


def _sign_payload(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload verification."""
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def fire_webhook(
    event_type: str,
    payload: dict[str, object],
    db: AsyncSession,
) -> list[dict[str, object]]:
    """Deliver a webhook event to all registered and active endpoints
    subscribed to the event type.

    Returns a list of delivery results.
    """
    result = await db.execute(
        select(Webhook).where(
            Webhook.is_active.is_(True),
        )
    )
    webhooks = result.scalars().all()

    delivery_results: list[dict[str, object]] = []

    for webhook in webhooks:
        # Check event subscription
        if event_type not in webhook.events and "*" not in webhook.events:
            continue

        body_str = json.dumps(
            {
                "event": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": payload,
            },
            default=str,
        )

        signature = _sign_payload(body_str, webhook.secret)

        try:
            async with httpx.AsyncClient(timeout=_DELIVERY_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    webhook.url,
                    content=body_str,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": signature,
                        "X-Webhook-Event": event_type,
                    },
                )

            delivery_results.append(
                {
                    "webhook_id": webhook.id,
                    "url": webhook.url,
                    "status_code": response.status_code,
                    "success": 200 <= response.status_code < 300,
                }
            )

        except Exception as exc:
            logger.exception("Webhook delivery failed for %s", webhook.url)
            delivery_results.append(
                {
                    "webhook_id": webhook.id,
                    "url": webhook.url,
                    "status_code": 0,
                    "success": False,
                    "error": str(exc),
                }
            )

    logger.info(
        "Fired webhook event %s to %d endpoints",
        event_type,
        len(delivery_results),
    )

    return delivery_results
