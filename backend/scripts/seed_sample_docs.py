"""Seed the document corpus from sample-docs/*.txt.

Runs the real ingestion pipeline (chunk -> embed -> store) so the document half
of grounded analysis has something to cite. Idempotency is NOT enforced — run
once, or clear the documents table first to avoid duplicates.

Usage (from repo root, with .env loaded):
    set -a && . ./.env && set +a
    ./.venv/bin/python backend/scripts/seed_sample_docs.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/

from app.core.database import async_session_factory  # noqa: E402
from app.ingestion.service import ingest_text  # noqa: E402

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "sample-docs"


async def main() -> None:
    files = sorted(SAMPLE_DIR.glob("*.txt"))
    if not files:
        print(f"No .txt files found in {SAMPLE_DIR}")
        return

    print(f"Ingesting {len(files)} document(s) from {SAMPLE_DIR}")
    async with async_session_factory() as db:
        for f in files:
            content = f.read_text(encoding="utf-8", errors="replace")
            doc_id = await ingest_text(
                content,
                f.stem.replace("-", " ").title(),
                db,
                metadata={"seed": True, "filename": f.name},
            )
            await db.commit()
            print(f"  ingested {f.name}  ->  {doc_id}")
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
