from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

_DEFAULT_CHUNK_SIZE = 1000
_DEFAULT_CHUNK_OVERLAP = 200


@dataclass
class TextChunk:
    id: str
    content: str
    chunk_index: int
    metadata: dict[str, object] = field(default_factory=dict)


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    metadata: dict[str, object] | None = None,
) -> list[TextChunk]:
    """Recursive text splitter that tries paragraph, sentence, then word boundaries."""
    size = chunk_size or _DEFAULT_CHUNK_SIZE
    overlap = chunk_overlap or _DEFAULT_CHUNK_OVERLAP
    base_metadata = metadata or {}

    separators = ["\n\n", "\n", ". ", " "]
    raw_chunks = _recursive_split(text, separators, size, overlap)

    return [
        TextChunk(
            id=uuid4().hex,
            content=chunk.strip(),
            chunk_index=i,
            metadata={**base_metadata},
        )
        for i, chunk in enumerate(raw_chunks)
        if chunk.strip()
    ]


def _recursive_split(
    text: str,
    separators: list[str],
    chunk_size: int,
    chunk_overlap: int,
) -> list[str]:
    if len(text) <= chunk_size:
        return [text]

    # Try each separator in order of preference (coarsest to finest)
    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            return _merge_parts(parts, sep, chunk_size, chunk_overlap)

    # No separator found -- hard split
    return _hard_split(text, chunk_size, chunk_overlap)


def _merge_parts(
    parts: list[str],
    separator: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for part in parts:
        part_len = len(part) + len(separator)

        if current_len + part_len > chunk_size and current:
            chunks.append(separator.join(current))
            # Keep tail parts for overlap
            overlap_parts: list[str] = []
            overlap_len = 0
            for prev in reversed(current):
                if overlap_len + len(prev) + len(separator) > chunk_overlap:
                    break
                overlap_parts.insert(0, prev)
                overlap_len += len(prev) + len(separator)
            current = overlap_parts
            current_len = overlap_len

        current.append(part)
        current_len += part_len

    if current:
        chunks.append(separator.join(current))

    return chunks


def _hard_split(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - chunk_overlap
    return chunks
