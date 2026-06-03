from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # Application
    APP_NAME: str = "Innovation Intelligence Copilot"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # PostgreSQL + pgvector
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/innovation_intel"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
