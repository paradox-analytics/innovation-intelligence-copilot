"""Lightweight LLM usage + cost estimation logging.

Lets every Claude call report input/output tokens and an estimated dollar cost,
so a single analysis run produces a per-call cost breakdown in the logs.
"""

from __future__ import annotations

import logging

# USD per 1M tokens: (input, output). Keep in sync with current pricing.
_PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
_DEFAULT_PRICE = (3.0, 15.0)
_WEB_SEARCH_USD_PER_1K = 10.0  # Anthropic server-side web search: ~$10 / 1,000 searches


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    web_searches: int = 0,
) -> float:
    in_price, out_price = _PRICES.get(model, _DEFAULT_PRICE)
    cost = (
        input_tokens * in_price
        + output_tokens * out_price
        + cache_read_tokens * in_price * 0.1  # cache reads ~0.1x input price
    ) / 1_000_000
    cost += web_searches * (_WEB_SEARCH_USD_PER_1K / 1000)
    return cost


def log_usage(
    logger: logging.Logger,
    label: str,
    model: str,
    usage: object,
    web_searches: int = 0,
) -> float:
    """Log token usage + estimated cost for one call. Returns the estimate."""
    inp = int(getattr(usage, "input_tokens", 0) or 0)
    out = int(getattr(usage, "output_tokens", 0) or 0)
    cache_read = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
    cost = estimate_cost(model, inp, out, cache_read, web_searches)
    logger.info(
        "llm_usage label=%s model=%s in=%d out=%d cache_read=%d web_searches=%d est_cost=$%.4f",
        label,
        model,
        inp,
        out,
        cache_read,
        web_searches,
        cost,
    )
    return cost
