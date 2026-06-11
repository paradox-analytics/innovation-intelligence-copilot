from __future__ import annotations

import logging
import re
import sys

import structlog

# ---------------------------------------------------------------------------
# Sensitive-data redactor
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
)
_API_KEY_PATTERNS = re.compile(
    r"(?:sk-[a-zA-Z0-9_-]{20,})"  # OpenAI-style
    r"|(?:sk-ant-[a-zA-Z0-9_-]{20,})"  # Anthropic-style
    r"|(?:iic_[a-zA-Z0-9_-]{20,})"  # Internal API keys
    r"|(?:Bearer\s+[a-zA-Z0-9._-]{20,})",  # JWT bearer tokens in log text
)

_REDACTED = "***REDACTED***"


def _redact_value(value: object) -> object:
    """Recursively redact sensitive strings from a log value."""
    if isinstance(value, str):
        value = _EMAIL_RE.sub(_REDACTED, value)
        value = _API_KEY_PATTERNS.sub(_REDACTED, value)
        return value
    if isinstance(value, dict):
        return {k: _redact_value(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return type(value)(_redact_value(v) for v in value)
    return value


def sanitize_log_output(
    _logger: logging.Logger,
    _method_name: str,
    event_dict: dict[str, object],
) -> dict[str, object]:
    """structlog processor that redacts emails and API keys from all fields."""
    return {k: _redact_value(v) for k, v in event_dict.items()}


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------


def setup_logging(environment: str = "development", log_level: str = "INFO") -> None:
    """Configure structlog and stdlib logging for the application.

    Args:
        environment: ``"development"`` for pretty console output,
                     ``"production"`` or ``"staging"`` for JSON lines.
        log_level: Python log level name (DEBUG, INFO, WARNING, ERROR).
    """
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        sanitize_log_output,
    ]

    if environment in ("production", "staging"):
        # JSON output for log aggregators
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        # Pretty, coloured console output for development
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # stdlib formatter powered by structlog
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )

    # Root handler
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Quieten noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "neo4j", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
