"""Live web retrieval via Anthropic's server-side web_search / web_fetch tools.

Replaces the old mock WebSearchTool. Claude searches the live web, reads the
most relevant pages, and returns a structured list of sources with REAL URLs.
We validate every returned URL against the URLs Claude actually searched, so a
hallucinated link can't slip through as a citation.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime

import anthropic

from app.core.config import settings
from app.core.usage import estimate_cost

logger = logging.getLogger(__name__)

# Dynamic-filtering web tools (GA on Sonnet 4.6 — no beta header needed).
_WEB_SEARCH_TOOL = "web_search_20260209"
_WEB_FETCH_TOOL = "web_fetch_20260209"
_MAX_PAUSE_CONTINUATIONS = 4

_SYSTEM_PROMPT = """\
You are a research librarian gathering primary sources to answer a strategic \
technology question. Use the web_search and web_fetch tools to find the most \
relevant, recent, and credible sources (analyst reports, filings, research \
papers, reputable news, standards bodies).

When you have gathered enough, respond with ONLY a JSON array of the sources \
you actually retrieved — no prose, no markdown fences:
[
  {
    "title": "source title",
    "url": "the exact URL you retrieved",
    "snippet": "1-2 sentence factual finding from this source relevant to the question",
    "relevance": "high" | "medium" | "low"
  }
]

Rules:
- Only include URLs you actually opened via the tools.
- Prefer 5-8 high-signal sources over many weak ones.
- STRONGLY prefer sources from the last 12 months — the most recent data should
  anchor any forward-looking projection. Use older sources only for essential
  background, and prefer newer data when sources conflict.
- The snippet must be a concrete, citable fact — not a summary of the whole page."""

_RELEVANCE_SCORE = {"high": 0.85, "medium": 0.6, "low": 0.4}


@dataclass
class WebSource:
    title: str
    url: str
    snippet: str
    relevance: str  # high | medium | low
    relevance_score: float


def _collect_searched_urls(content: list[object]) -> dict[str, str]:
    """Map every URL Claude actually retrieved -> its title, from tool-result blocks."""
    urls: dict[str, str] = {}
    for block in content:
        btype = getattr(block, "type", None)
        if btype not in ("web_search_tool_result", "web_fetch_tool_result"):
            continue
        results = getattr(block, "content", None)
        # web_fetch returns a single result object; web_search returns a list.
        items = results if isinstance(results, list) else [results]
        for item in items:
            url = getattr(item, "url", None)
            if url:
                urls[url] = getattr(item, "title", "") or url
    return urls


def _collect_text(content: list[object]) -> str:
    parts: list[str] = []
    for block in content:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", "") or "")
    return "\n".join(parts).strip()


def _parse_sources(raw: str) -> list[dict[str, object]]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.rstrip().endswith("```"):
            raw = raw.rsplit("```", 1)[0]
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("["), raw.rfind("]")
        if start < 0 or end <= start:
            return []
        try:
            parsed = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return []
    return parsed if isinstance(parsed, list) else []


def _url_was_searched(url: str, searched: dict[str, str]) -> bool:
    """Loose match — Claude may return a canonicalized form of a searched URL."""
    if url in searched:
        return True
    norm = url.rstrip("/")
    return any(norm == s.rstrip("/") or norm in s or s in norm for s in searched)


async def search_web(query: str, max_sources: int = 8) -> list[WebSource]:
    """Run a live web search and return validated sources. Never raises."""
    if not settings.ENABLE_WEB_SEARCH:
        return []
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("web_search skipped: ANTHROPIC_API_KEY not set")
        return []

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    tools = [
        {"type": _WEB_SEARCH_TOOL, "name": "web_search", "max_uses": settings.WEB_SEARCH_MAX_USES},
        {"type": _WEB_FETCH_TOOL, "name": "web_fetch", "max_uses": settings.WEB_SEARCH_MAX_USES},
    ]
    today = datetime.now(UTC).date().isoformat()
    messages: list[dict[str, object]] = [
        {
            "role": "user",
            "content": (
                f"Today's date is {today}. Strongly prefer the most recent sources.\n\n"
                f"Strategic question: {query}"
            ),
        }
    ]

    model = settings.WEB_SEARCH_MODEL
    all_content: list[object] = []
    tok_in = tok_out = tok_cache = searches = 0
    try:
        for _ in range(_MAX_PAUSE_CONTINUATIONS + 1):
            response = await client.messages.create(
                model=model,
                max_tokens=4096,
                temperature=settings.ANALYSIS_TEMPERATURE,
                system=_SYSTEM_PROMPT,
                tools=tools,  # type: ignore[arg-type]
                messages=messages,  # type: ignore[arg-type]
            )
            u = response.usage
            tok_in += int(getattr(u, "input_tokens", 0) or 0)
            tok_out += int(getattr(u, "output_tokens", 0) or 0)
            tok_cache += int(getattr(u, "cache_read_input_tokens", 0) or 0)
            stu = getattr(u, "server_tool_use", None)
            searches += int(getattr(stu, "web_search_requests", 0) or 0) if stu else 0
            all_content.extend(response.content)
            if response.stop_reason != "pause_turn":
                break
            # Server tool loop hit its iteration cap — re-send to resume.
            messages.append({"role": "assistant", "content": response.content})
    except Exception:
        logger.exception("web_search failed for query=%r", query[:80])
        return []

    logger.info(
        "web_search_usage model=%s in=%d out=%d cache_read=%d web_searches=%d est_cost=$%.4f",
        model,
        tok_in,
        tok_out,
        tok_cache,
        searches,
        estimate_cost(model, tok_in, tok_out, tok_cache, searches),
    )

    searched = _collect_searched_urls(all_content)
    parsed = _parse_sources(_collect_text(all_content))

    sources: list[WebSource] = []
    seen: set[str] = set()
    for item in parsed:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "")).strip()
        if not url or url in seen:
            continue
        # Drop anything Claude didn't actually retrieve (anti-hallucination guard).
        if searched and not _url_was_searched(url, searched):
            continue
        seen.add(url)
        relevance = str(item.get("relevance", "medium")).lower()
        if relevance not in _RELEVANCE_SCORE:
            relevance = "medium"
        sources.append(
            WebSource(
                title=str(item.get("title") or searched.get(url, url)),
                url=url,
                snippet=str(item.get("snippet", "")),
                relevance=relevance,
                relevance_score=_RELEVANCE_SCORE[relevance],
            )
        )
        if len(sources) >= max_sources:
            break

    # Fallback: model returned no parseable JSON but did search — use raw results.
    if not sources and searched:
        for url, title in list(searched.items())[:max_sources]:
            sources.append(
                WebSource(
                    title=title,
                    url=url,
                    snippet="",
                    relevance="medium",
                    relevance_score=_RELEVANCE_SCORE["medium"],
                )
            )

    logger.info("web_search: %d sources for query=%r", len(sources), query[:80])
    return sources
