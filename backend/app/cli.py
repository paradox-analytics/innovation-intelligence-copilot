"""CLI utilities for Innovation Intelligence Copilot.

Usage::

    python -m app.cli seed       # Populate database with sample data
    python -m app.cli migrate    # Run Alembic migrations
    python -m app.cli create-admin  # Create an admin user
    python -m app.cli health     # Check service connectivity
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from getpass import getpass
from pathlib import Path
from uuid import uuid4

# ---------------------------------------------------------------------------
# Seed command
# ---------------------------------------------------------------------------


async def _seed() -> None:
    """Seed the database and Neo4j with sample data."""
    from app.core.database import async_session_factory, engine, init_db
    from app.core.neo4j_client import neo4j_client
    from app.models.analysis import AnalysisRequest, AnalysisStatus
    from app.models.document import DocType, Document
    from app.models.knowledge import Entity, EntityType, Relationship

    seed_path = Path(__file__).resolve().parent.parent / "scripts" / "seed_data.json"
    if not seed_path.exists():
        print(f"ERROR: Seed data file not found at {seed_path}")
        sys.exit(1)

    with open(seed_path) as f:
        data: dict[str, object] = json.load(f)

    # --- PostgreSQL ---
    print("Initialising database schema...")
    await init_db()

    now = datetime.now(UTC)

    async with async_session_factory() as session:
        # Documents
        docs_data = data.get("documents", [])
        if not isinstance(docs_data, list):
            docs_data = []
        for doc in docs_data:
            if not isinstance(doc, dict):
                continue
            session.add(
                Document(
                    id=str(doc["id"]),
                    title=str(doc["title"]),
                    content=str(doc.get("content", "")),
                    source_url=doc.get("source_url"),  # type: ignore[arg-type]
                    doc_type=DocType(str(doc.get("doc_type", "REPORT"))),
                    metadata_=doc.get("metadata"),  # type: ignore[arg-type]
                    created_at=now,
                    updated_at=now,
                )
            )
        print(f"  Seeded {len(docs_data)} documents")

        # Entities
        entities_data = data.get("entities", [])
        if not isinstance(entities_data, list):
            entities_data = []
        for ent in entities_data:
            if not isinstance(ent, dict):
                continue
            session.add(
                Entity(
                    id=str(ent["id"]),
                    name=str(ent["name"]),
                    entity_type=EntityType(str(ent["entity_type"])),
                    properties=ent.get("properties"),  # type: ignore[arg-type]
                )
            )
        print(f"  Seeded {len(entities_data)} entities")

        # Relationships
        rels_data = data.get("relationships", [])
        if not isinstance(rels_data, list):
            rels_data = []
        for rel in rels_data:
            if not isinstance(rel, dict):
                continue
            session.add(
                Relationship(
                    id=str(rel["id"]),
                    source_entity_id=str(rel["source_entity_id"]),
                    target_entity_id=str(rel["target_entity_id"]),
                    relationship_type=str(rel["relationship_type"]),
                    properties=rel.get("properties"),  # type: ignore[arg-type]
                )
            )
        print(f"  Seeded {len(rels_data)} relationships")

        # Completed analysis
        analysis_data = data.get("analysis")
        if isinstance(analysis_data, dict):
            session.add(
                AnalysisRequest(
                    id=str(analysis_data["id"]),
                    query=str(analysis_data["query"]),
                    status=AnalysisStatus(str(analysis_data.get("status", "COMPLETED"))),
                    result=analysis_data.get("result"),  # type: ignore[arg-type]
                    confidence_score=float(analysis_data.get("confidence_score", 0)),  # type: ignore[arg-type]
                    created_at=now,
                    completed_at=now,
                )
            )
            print("  Seeded 1 completed analysis")

        await session.commit()
        print("PostgreSQL seed complete.")

    # --- Neo4j ---
    print("Seeding Neo4j knowledge graph...")
    try:
        await neo4j_client.connect()

        # Create entity nodes
        for ent in entities_data:
            if not isinstance(ent, dict):
                continue
            entity_type = str(ent["entity_type"])
            props = ent.get("properties", {})
            if not isinstance(props, dict):
                props = {}
            await neo4j_client.execute_write(
                f"MERGE (n:{entity_type} {{id: $id}}) "
                "SET n.name = $name, n.properties = $properties",
                {
                    "id": str(ent["id"]),
                    "name": str(ent["name"]),
                    "properties": json.dumps(props),
                },
            )

        # Create relationships
        for rel in rels_data:
            if not isinstance(rel, dict):
                continue
            rel_type = str(rel["relationship_type"])
            rel_props = rel.get("properties", {})
            if not isinstance(rel_props, dict):
                rel_props = {}
            await neo4j_client.execute_write(
                "MATCH (a {id: $source_id}), (b {id: $target_id}) "
                f"MERGE (a)-[r:{rel_type}]->(b) "
                "SET r.properties = $properties",
                {
                    "source_id": str(rel["source_entity_id"]),
                    "target_id": str(rel["target_entity_id"]),
                    "properties": json.dumps(rel_props),
                },
            )

        print(f"  Created {len(entities_data)} nodes and {len(rels_data)} relationships in Neo4j")
        await neo4j_client.close()
    except Exception as exc:
        print(f"  WARNING: Neo4j seed skipped ({exc})")

    await engine.dispose()
    print("Seed complete.")


# ---------------------------------------------------------------------------
# Migrate command
# ---------------------------------------------------------------------------


def _migrate() -> None:
    """Run Alembic migrations (upgrade head)."""
    import subprocess

    backend_dir = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=str(backend_dir),
        capture_output=False,
    )
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# Create admin command
# ---------------------------------------------------------------------------


async def _create_admin() -> None:
    """Interactively create an admin user."""
    from app.core.database import async_session_factory, engine, init_db
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    email = input("Admin email: ").strip()
    if not email:
        print("ERROR: Email is required.")
        sys.exit(1)

    full_name = input("Full name: ").strip() or "Admin"

    password = getpass("Password (min 8 chars): ")
    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.")
        sys.exit(1)

    confirm = getpass("Confirm password: ")
    if password != confirm:
        print("ERROR: Passwords do not match.")
        sys.exit(1)

    await init_db()

    now = datetime.now(UTC)
    user = User(
        id=uuid4().hex,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=UserRole.ADMIN,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    async with async_session_factory() as session:
        session.add(user)
        await session.commit()

    await engine.dispose()
    print(f"Admin user created: {email} (role=ADMIN)")


# ---------------------------------------------------------------------------
# Health command
# ---------------------------------------------------------------------------


async def _health() -> None:
    """Check connectivity to all backing services."""
    import time

    from app.core.config import settings

    results: dict[str, tuple[str, float, str | None]] = {}

    # PostgreSQL
    start = time.monotonic()
    try:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        test_engine = create_async_engine(settings.DATABASE_URL)
        async with test_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await test_engine.dispose()
        elapsed = (time.monotonic() - start) * 1000
        results["PostgreSQL"] = ("healthy", elapsed, None)
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        results["PostgreSQL"] = ("unhealthy", elapsed, str(exc))

    # Neo4j
    start = time.monotonic()
    try:
        from neo4j import AsyncGraphDatabase

        driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        await driver.verify_connectivity()
        await driver.close()
        elapsed = (time.monotonic() - start) * 1000
        results["Neo4j"] = ("healthy", elapsed, None)
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        results["Neo4j"] = ("unhealthy", elapsed, str(exc))

    # Redis
    start = time.monotonic()
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await client.ping()
        await client.aclose()
        elapsed = (time.monotonic() - start) * 1000
        results["Redis"] = ("healthy", elapsed, None)
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        results["Redis"] = ("unhealthy", elapsed, str(exc))

    # Print results
    print()
    print("Service Health Check")
    print("=" * 60)
    for service, (status, latency, error) in results.items():
        icon = "OK" if status == "healthy" else "FAIL"
        line = f"  [{icon}] {service:<15} {latency:>8.1f}ms"
        if error:
            line += f"  ({error})"
        print(line)
    print("=" * 60)

    unhealthy = sum(1 for _, (s, _, _) in results.items() if s == "unhealthy")
    if unhealthy == 0:
        print("All services healthy.")
    else:
        print(f"{unhealthy} service(s) unhealthy.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="app.cli",
        description="Innovation Intelligence Copilot — CLI utilities",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("seed", help="Seed database with sample data")
    sub.add_parser("migrate", help="Run Alembic migrations (upgrade head)")
    sub.add_parser("create-admin", help="Create an admin user interactively")
    sub.add_parser("health", help="Check all service connections")

    args = parser.parse_args()

    if args.command == "seed":
        asyncio.run(_seed())
    elif args.command == "migrate":
        _migrate()
    elif args.command == "create-admin":
        asyncio.run(_create_admin())
    elif args.command == "health":
        asyncio.run(_health())
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
