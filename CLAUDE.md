# Innovation Intelligence Copilot — Repository Constitution

## Product Overview

**Innovation Intelligence Copilot** is an AI-powered innovation intelligence platform for enterprise technology advisory. It enables analysts, strategists, and technology leaders to monitor emerging technologies, evaluate innovation signals, generate strategic intelligence reports, and make data-driven technology adoption decisions.

The platform ingests diverse data sources (research papers, patent filings, market reports, news, analyst briefings), builds a knowledge graph of technology relationships, and uses multi-agent AI workflows to produce actionable intelligence artifacts.

---

## Stack

- **Language:** Python 3.12 (backend), TypeScript (frontend)
- **Backend Framework:** FastAPI with async support
- **AI Orchestration:** LangGraph (multi-agent workflows)
- **LLM Providers:** Anthropic Claude API (`anthropic`), OpenAI API (`openai`)
- **Vector Store:** PostgreSQL + pgvector (RAG embeddings)
- **Knowledge Graph:** Neo4j (technology relationships, innovation signals)
- **Frontend Framework:** Next.js 15 (App Router, TypeScript, `src/` directory)
- **UI:** React 19 + Tailwind CSS v4 + shadcn/ui
- **Cache / Queue:** Redis (caching, task queues)
- **Dependency Management:** Poetry (Python), npm (Node.js)
- **Containerization:** Docker + Docker Compose
- **Testing:** pytest + pytest-asyncio (backend), Vitest (frontend)

---

## Architecture Decisions

1. **Multi-agent orchestration** — LangGraph coordinates specialized agents (research, analysis, synthesis, critique) that collaborate to produce intelligence outputs. Each agent has a defined role, tools, and state schema.

2. **RAG pipeline with pgvector** — Documents are chunked, embedded, and stored in PostgreSQL via pgvector. Retrieval-augmented generation grounds LLM responses in source material with mandatory citation.

3. **Knowledge graph (Neo4j)** — Technologies, companies, trends, and signals are modeled as nodes and edges. Graph queries power relationship discovery, impact analysis, and technology adjacency mapping.

4. **Decision intelligence layer** — Combines RAG retrieval, graph traversal, and agent reasoning to produce structured decision frameworks (technology readiness assessments, build/buy/partner recommendations, risk matrices).

5. **Source attribution required** — Every generated insight must trace back to ingested sources. No hallucinated claims without grounding.

6. **Async-first ingestion** — Document ingestion, embedding generation, and graph population run asynchronously via task queues. API endpoints for queries are synchronous with streaming support.

7. **Modular connector design** — Data source connectors (arXiv, USPTO, news APIs, RSS) implement a shared `SourceConnector` interface for consistent ingestion.

---

## Module Structure

```
backend/
├── app/
│   ├── api/              — FastAPI routes
│   │   └── v1/
│   │       └── endpoints/ — Versioned endpoint modules
│   │           ├── analysis.py   — Strategic analysis endpoints
│   │           ├── documents.py  — Document ingestion endpoints
│   │           ├── knowledge.py  — Knowledge graph endpoints
│   │           └── reports.py    — Report generation endpoints
│   ├── agents/           — LangGraph agent definitions
│   │   ├── base.py           — Abstract base agent with tracing
│   │   ├── research_agent.py — Source discovery + evidence collection
│   │   ├── support_agent.py  — Investment case builder
│   │   ├── skeptic_agent.py  — Contrarian analysis + assumption challenger
│   │   ├── risk_agent.py     — Risk identification + assessment
│   │   ├── trend_agent.py    — Technology signal detection
│   │   ├── executive_agent.py — Final synthesis + recommendation
│   │   └── orchestrator.py   — LangGraph workflow orchestration
│   ├── rag/              — RAG pipeline
│   │   ├── embeddings.py     — OpenAI embedding generation
│   │   ├── retriever.py      — Hybrid retrieval (semantic + keyword + RRF)
│   │   └── chunker.py        — Recursive document chunking
│   ├── graph/            — Neo4j knowledge graph
│   │   ├── service.py        — Entity/relationship CRUD + signal detection
│   │   └── entity_extractor.py — Claude-powered entity extraction
│   ├── reports/          — Report generation
│   │   └── generator.py      — Markdown + JSON report rendering
│   ├── ingestion/        — Data source ingestion
│   │   └── service.py        — PDF parsing + chunking + embedding pipeline
│   ├── models/           — SQLAlchemy models + domain types
│   │   ├── document.py       — Document + DocumentChunk
│   │   ├── analysis.py       — AnalysisRequest + AgentTrace
│   │   └── knowledge.py      — Entity + Relationship
│   └── core/             — Shared infrastructure
│       ├── config.py         — Pydantic Settings + env var loading
│       ├── database.py       — Async SQLAlchemy + pgvector setup
│       └── neo4j_client.py   — Neo4j driver wrapper
├── tests/
│   ├── unit/             — Unit tests
│   └── integration/      — Integration tests
└── pyproject.toml

frontend/
├── src/
│   ├── app/              — Next.js App Router pages + layouts
│   ├── components/
│   │   ├── ui/               — shadcn/ui base components
│   │   ├── dashboard/        — Dashboard widgets + layouts
│   │   └── reports/          — Report viewing + interaction
│   ├── lib/              — Shared utilities (API client, cn(), etc.)
│   └── hooks/            — Custom React hooks
├── public/               — Static assets
├── package.json
└── tsconfig.json

docker/                   — Dockerfiles + compose configs
docs/                     — Architecture docs + ADRs
tests/                    — End-to-end tests
```

---

## Conventions

### File naming
- **Python:** snake_case for all files and directories (`research_agent.py`, `vector_store.py`)
- **TypeScript components:** PascalCase (`TechRadar.tsx`, `ReportViewer.tsx`) — except shadcn/ui which uses kebab-case
- **TypeScript utilities:** camelCase (`apiClient.ts`, `useReport.ts`)
- **Tests:** mirror source structure with `test_` prefix (Python) or `.test.ts` suffix (TypeScript)

### API patterns
- All routes versioned under `/api/v1/`
- Request/response validation with Pydantic models
- Return `{"data": ..., "meta": {...}}` for lists (include `total`, `page`, `page_size`)
- Return `{"data": ...}` for single items
- Return `{"error": {"code": "...", "message": "...", "details": [...]}}` for errors
- Use appropriate HTTP status codes (400 validation, 401 auth, 404 not found, 422 processing, 500 internal)
- Long-running operations return 202 with a task ID for polling
- Streaming endpoints use Server-Sent Events (SSE)

### Python style
- Type hints required on all function signatures (enforced by mypy strict mode)
- Async functions for all I/O-bound operations
- Pydantic v2 models for all data structures
- Docstrings on all public functions and classes (Google style)
- Line length: 100 characters (enforced by ruff)

### TypeScript style
- Strict TypeScript — no `any` types, use `unknown` with type guards
- Server components by default, `"use client"` only when needed
- Prefer server actions for mutations

### Testing
- Unit tests: mock external services, test business logic in isolation
- Integration tests: use Docker test containers for Postgres, Neo4j, Redis
- Minimum coverage target: 80% for business logic modules
- Agent tests: use recorded LLM responses (cassettes) for deterministic testing

### Environment variables
- All config loaded via Pydantic `BaseSettings` in `backend/app/core/config.py`
- Never import `os.environ` directly — use the settings object
- Frontend env vars prefixed with `NEXT_PUBLIC_` for client-side access

---

## Development

```bash
# Start all services (Postgres+pgvector, Neo4j, Redis)
docker compose up -d

# Backend setup
cd backend
poetry install
poetry run alembic upgrade head    # Run migrations
poetry run uvicorn app.main:app --reload --port 8000

# Frontend setup
cd frontend
npm install
npm run dev                        # Starts on port 3000

# Run backend tests
cd backend
poetry run pytest
poetry run pytest --cov=app        # With coverage

# Linting + type checking
cd backend
poetry run ruff check .
poetry run ruff format .
poetry run mypy app/

cd frontend
npm run lint
npm run type-check

# Database operations
poetry run alembic revision --autogenerate -m "description"  # Create migration
poetry run alembic upgrade head                               # Apply migrations
poetry run alembic downgrade -1                               # Rollback one

# Docker (full stack)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Hard Rules

- **No secrets committed** — use `.env` locally, CI/CD secrets in production. `.env` is gitignored.
- **Source attribution required** — every generated insight must cite its source documents. No ungrounded claims.
- **No raw PII in logs** — hash or redact email addresses, names, and API keys in all log output.
- **All user input validated** — Pydantic models validate every API request before processing.
- **Type hints required** — all Python functions must have complete type annotations (enforced by mypy strict).
- **No `any` types** — TypeScript must use `unknown` with type guards, never `any`.
- **Async I/O** — all database, HTTP, and external service calls must be async.
- **Error boundaries** — agents must handle LLM failures gracefully with retry logic and fallbacks.
- **Embedding cost awareness** — batch embedding operations, cache results, avoid redundant re-embedding.
- **Graph consistency** — Neo4j writes must be transactional; never leave partial graph state.

---

## MVP Scope

### Included
- Document ingestion pipeline (PDF, HTML, plain text)
- RAG-powered question answering with source citations
- Knowledge graph construction from ingested documents
- Multi-agent research workflow (research -> analyze -> synthesize -> critique)
- Technology landscape reports (auto-generated)
- Interactive dashboard with technology radar visualization
- Trend monitoring with alert notifications
- API key authentication
- Docker Compose deployment

### Deferred
- Multi-tenant workspace isolation
- Custom connector marketplace
- Real-time collaborative editing
- Advanced graph analytics (community detection, centrality)
- Patent analysis pipeline
- Competitive intelligence module
- SSO / SAML authentication
- Kubernetes deployment configs
- Usage-based billing
