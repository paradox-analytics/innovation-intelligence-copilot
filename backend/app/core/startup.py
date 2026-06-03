from __future__ import annotations

import logging
import re

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Placeholder patterns that should never appear in production
# ---------------------------------------------------------------------------

_PLACEHOLDER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^change-?me", re.IGNORECASE),
    re.compile(r"^xxx+", re.IGNORECASE),
    re.compile(r"^sk-ant-xxx", re.IGNORECASE),
    re.compile(r"^sk-xxx", re.IGNORECASE),
    re.compile(r"^generate-with-", re.IGNORECASE),
    re.compile(r"^your[_-]", re.IGNORECASE),
    re.compile(r"^placeholder", re.IGNORECASE),
    re.compile(r"^TODO", re.IGNORECASE),
]


def _is_placeholder(value: str) -> bool:
    return any(p.search(value) for p in _PLACEHOLDER_PATTERNS)


# ---------------------------------------------------------------------------
# Database URL validation
# ---------------------------------------------------------------------------

_VALID_DB_SCHEMES = (
    "postgresql+asyncpg://",
    "postgresql://",
    "postgres://",
)


def _validate_database_url(url: str) -> list[str]:
    errors: list[str] = []
    if not any(url.startswith(scheme) for scheme in _VALID_DB_SCHEMES):
        errors.append(
            f"DATABASE_URL must start with one of {_VALID_DB_SCHEMES}, got: {url[:30]}..."
        )
    if "@" not in url:
        errors.append(
            "DATABASE_URL appears malformed (missing '@' separating credentials from host)."
        )
    if "/" not in url.split("@", 1)[-1]:
        errors.append(
            "DATABASE_URL appears malformed (missing database name after host)."
        )
    return errors


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_environment() -> None:
    """Validate required environment variables and configuration.

    Call during application startup (lifespan). Raises ``SystemExit`` with
    a clear message when critical configuration is missing or invalid.
    Logs warnings for optional but recommended settings.
    """
    errors: list[str] = []
    warnings: list[str] = []

    is_production = getattr(settings, "ENVIRONMENT", "development") in (
        "production",
        "staging",
    )
    environment = getattr(settings, "ENVIRONMENT", "development")

    # ------------------------------------------------------------------
    # Required: DATABASE_URL
    # ------------------------------------------------------------------
    db_url = settings.DATABASE_URL
    if not db_url:
        errors.append(
            "DATABASE_URL is required. Set it in .env or as an environment variable.\n"
            "  Example: DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname"
        )
    else:
        errors.extend(_validate_database_url(db_url))

    # ------------------------------------------------------------------
    # Required: SECRET_KEY (must not be placeholder in production)
    # ------------------------------------------------------------------
    if not settings.SECRET_KEY:
        errors.append(
            "SECRET_KEY is required. Generate one with:\n"
            "  openssl rand -base64 32"
        )
    elif is_production and _is_placeholder(settings.SECRET_KEY):
        errors.append(
            "SECRET_KEY is set to a placeholder value. Generate a real secret with:\n"
            "  openssl rand -base64 32"
        )

    # ------------------------------------------------------------------
    # Required in production: LLM API keys
    # ------------------------------------------------------------------
    if is_production:
        if not settings.ANTHROPIC_API_KEY or _is_placeholder(settings.ANTHROPIC_API_KEY):
            errors.append(
                "ANTHROPIC_API_KEY is required in production. "
                "Get one from https://console.anthropic.com/"
            )
        if not settings.OPENAI_API_KEY or _is_placeholder(settings.OPENAI_API_KEY):
            errors.append(
                "OPENAI_API_KEY is required in production. "
                "Get one from https://platform.openai.com/"
            )

    # ------------------------------------------------------------------
    # Warnings for optional but recommended settings
    # ------------------------------------------------------------------
    if not settings.ANTHROPIC_API_KEY:
        warnings.append(
            "ANTHROPIC_API_KEY is not set. AI analysis features will not work."
        )

    if not settings.OPENAI_API_KEY:
        warnings.append(
            "OPENAI_API_KEY is not set. Embedding generation will not work."
        )

    if settings.SECRET_KEY and _is_placeholder(settings.SECRET_KEY) and not is_production:
        warnings.append(
            "SECRET_KEY is set to a placeholder value. This is acceptable for local "
            "development but must be changed before deploying."
        )

    neo4j_password = settings.NEO4J_PASSWORD
    if is_production and neo4j_password in ("password", "neo4j", "changeme"):
        warnings.append(
            "NEO4J_PASSWORD appears to be a default/weak value. "
            "Use a strong password in production."
        )

    # ------------------------------------------------------------------
    # Emit warnings
    # ------------------------------------------------------------------
    for warning in warnings:
        logger.warning("Environment warning: %s", warning)

    # ------------------------------------------------------------------
    # Fail hard on errors
    # ------------------------------------------------------------------
    if errors:
        msg_parts = [
            "",
            "=" * 70,
            "ENVIRONMENT CONFIGURATION ERRORS",
            "=" * 70,
        ]
        for i, error in enumerate(errors, 1):
            msg_parts.append(f"  {i}. {error}")
        msg_parts.append("=" * 70)
        msg_parts.append(
            f"Fix the above errors and restart. Environment: {environment}"
        )
        msg_parts.append("")
        full_message = "\n".join(msg_parts)
        logger.critical(full_message)
        raise SystemExit(full_message)

    logger.info(
        "Environment validation passed (environment=%s, warnings=%d)",
        environment,
        len(warnings),
    )
