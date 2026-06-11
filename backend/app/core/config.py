from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # Application
    APP_NAME: str = "Innovation Intelligence Copilot"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"  # noqa: S105 — default, overridden in prod
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # CORS — plain comma-separated string, parsed in main.py
    CORS_ORIGINS: str = "*"

    # PostgreSQL + pgvector
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/innovation_intel"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"  # noqa: S105 — default, overridden in prod

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # LLM Models
    DEFAULT_LLM_PROVIDER: str = "anthropic"
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    OPENAI_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Per-role analysis models (cost/quality tuning)
    # Extraction agents (support/skeptic/risk/trend) — cheap, structured tasks.
    AGENT_MODEL: str = "claude-haiku-4-5"
    # Executive synthesis — keep on Sonnet where judgment/prose quality matters.
    EXECUTIVE_MODEL: str = "claude-sonnet-4-6"
    # Web-search retrieval — Sonnet (dynamic-filtering web tools require it).
    WEB_SEARCH_MODEL: str = "claude-sonnet-4-6"

    # Retrieval / grounding
    # Live web search (Anthropic server-side web_search/web_fetch) for citations.
    # Bills per search AND pulls fetched page content in as input tokens — this is
    # the dominant cost of an analysis, so keep the cap low. Disable to ground only
    # on the ingested document corpus.
    ENABLE_WEB_SEARCH: bool = True
    WEB_SEARCH_MAX_USES: int = 2  # cap searches+fetches per analysis (cost control)

    # Feed completed analyses into the knowledge graph (one cheap entity-extraction
    # call per analysis). Disable to build the graph from documents only.
    ENABLE_KG_FROM_ANALYSIS: bool = True

    # Determinism / reproducibility
    # Greedy decoding (0.0) minimizes run-to-run drift. Anthropic has no seed, so
    # this is low-drift, not bit-exact.
    ANALYSIS_TEMPERATURE: float = 0.0
    # Reuse the retrieved evidence pool for an identical query (stops live web
    # results from changing the inputs between runs).
    ENABLE_EVIDENCE_CACHE: bool = True
    # Return a prior identical analysis verbatim (zero drift, zero cost) instead of
    # re-running. Invalidated when models/prompts/settings change.
    ENABLE_RESULT_CACHE: bool = True
    # Bump to invalidate caches when prompts change materially.
    ANALYSIS_PROMPT_VERSION: str = "1"

    # Sync DB URL (for alembic)
    DATABASE_URL_SYNC: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000/api/v1"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
