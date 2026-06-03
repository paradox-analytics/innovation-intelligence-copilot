from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession

from app.core.config import settings


class Neo4jClient:
    """Async Neo4j driver wrapper with query helpers."""

    _driver: AsyncDriver | None = None

    async def connect(self) -> None:
        """Initialize the Neo4j async driver."""
        self._driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        # Verify connectivity
        await self._driver.verify_connectivity()

    async def close(self) -> None:
        """Close the Neo4j driver."""
        if self._driver is not None:
            await self._driver.close()
            self._driver = None

    @property
    def driver(self) -> AsyncDriver:
        if self._driver is None:
            raise RuntimeError("Neo4j client is not connected. Call connect() first.")
        return self._driver

    async def get_session(self) -> AsyncSession:
        """Return a new Neo4j async session."""
        return self.driver.session()

    async def execute_read(
        self, query: str, parameters: dict[str, object] | None = None
    ) -> list[dict[str, Any]]:
        """Execute a read transaction and return results as list of dicts."""
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def execute_write(
        self, query: str, parameters: dict[str, object] | None = None
    ) -> list[dict[str, Any]]:
        """Execute a write transaction and return results as list of dicts."""
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def execute_query(
        self, query: str, parameters: dict[str, object] | None = None
    ) -> list[dict[str, Any]]:
        """General-purpose query execution."""
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            return await result.data()


neo4j_client = Neo4jClient()


async def get_graph_db() -> AsyncGenerator[Neo4jClient, None]:
    """FastAPI dependency that yields the Neo4j client."""
    yield neo4j_client
