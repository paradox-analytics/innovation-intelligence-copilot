from __future__ import annotations

import hashlib
import json
import logging

import anthropic

from app.core.config import settings
from app.models import GraphEntity, GraphRelationship

logger = logging.getLogger(__name__)

# Entity extraction is structured work — use the cheap agent model.
_DEFAULT_MODEL = settings.AGENT_MODEL


def _stable_entity_id(name: str, entity_type: str) -> str:
    """Deterministic id so the same (name, type) dedupes across documents and analyses."""
    key = f"{entity_type.strip().lower()}:{' '.join(name.split()).lower()}"
    return hashlib.md5(key.encode()).hexdigest()  # noqa: S324 — non-crypto, just a stable key


SYSTEM_PROMPT = """\
You are an entity extraction system for a technology knowledge graph. \
Extract entities and relationships from the given text.

Entity types: technology, company, startup, market, research_org, person, \
standard, regulation, product, patent.

Return a JSON object:
{
  "entities": [
    {
      "name": "entity name",
      "entity_type": "technology" | "company" | "startup" | "market" | ... ,
      "properties": {}
    }
  ],
  "relationships": [
    {
      "source": "source entity name",
      "target": "target entity name",
      "relationship_type": "develops" | "competes_with" | "acquires" | "partners_with" | "regulates" | "patents" | "researches" | "funds" | "uses",
      "properties": {}
    }
  ]
}

Extract ALL meaningful entities and relationships. Return valid JSON only, \
no markdown fences."""


async def extract_entities(
    text: str,
    document_id: str | None = None,
    provenance: str = "document",
) -> tuple[list[GraphEntity], list[GraphRelationship]]:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = await client.messages.create(
        model=_DEFAULT_MODEL,
        max_tokens=8192,
        temperature=settings.ANALYSIS_TEMPERATURE,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Extract the most important entities (max 20) and relationships (max 15) from:\n\n{text[:4000]}",
            }
        ],
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if Claude wrapped the JSON
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()

    # Try to extract JSON even if there's surrounding text
    if not raw.startswith("{"):
        start = raw.find("{")
        if start >= 0:
            raw = raw[start:]
        end = raw.rfind("}")
        if end >= 0:
            raw = raw[: end + 1]

    try:
        parsed: dict[str, list[dict[str, object]]] = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Entity extraction returned invalid JSON, attempting repair")
        # Last resort: find the first { and last }
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            parsed = json.loads(raw[start : end + 1])
        else:
            logger.error("Could not parse entity extraction response: %s", raw[:200])
            return [], []

    # Build name-to-id mapping so relationships can reference stable IDs
    name_to_id: dict[str, str] = {}
    entities: list[GraphEntity] = []

    for item in parsed.get("entities", []):
        name = str(item.get("name", ""))
        entity_type = str(item.get("entity_type", "unknown"))
        entity_id = _stable_entity_id(name, entity_type)
        name_to_id[name.lower()] = entity_id

        props: dict[str, object] = item.get("properties", {}) or {}
        props["provenance"] = provenance
        if document_id:
            props["source_document_id"] = document_id

        entities.append(
            GraphEntity(
                id=entity_id,
                name=name,
                entity_type=entity_type,
                properties=props,
            )
        )

    relationships: list[GraphRelationship] = []
    for item in parsed.get("relationships", []):
        source_name = str(item.get("source", "")).lower()
        target_name = str(item.get("target", "")).lower()

        source_id = name_to_id.get(source_name)
        target_id = name_to_id.get(target_name)

        if source_id is None or target_id is None:
            logger.warning(
                "Skipping relationship %s -> %s: entity not found",
                item.get("source"),
                item.get("target"),
            )
            continue

        rel_props: dict[str, object] = item.get("properties", {}) or {}
        rel_props["provenance"] = provenance
        relationships.append(
            GraphRelationship(
                source_id=source_id,
                target_id=target_id,
                relationship_type=str(item.get("relationship_type", "related_to")),
                properties=rel_props,
            )
        )

    return entities, relationships
