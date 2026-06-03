# Contributing to Innovation Intelligence Copilot

Thank you for your interest in contributing. This document describes the workflow, standards, and expectations for all contributions.

---

## Getting Started

1. **Fork** the repository to your GitHub account.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/innovation-intelligence-copilot.git
   cd innovation-intelligence-copilot
   ```
3. **Install dependencies** (see [README.md](README.md) for full setup instructions):
   ```bash
   # Backend
   poetry install

   # Frontend
   cd frontend && npm install
   ```
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Branch Naming

Use prefixes that describe the change type:

| Prefix     | Purpose                          |
|------------|----------------------------------|
| `feat/`    | New feature                      |
| `fix/`     | Bug fix                          |
| `refactor/`| Code restructuring (no behavior change) |
| `docs/`    | Documentation only               |
| `test/`    | Adding or updating tests         |
| `chore/`   | Build, CI, tooling changes       |

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`

**Examples:**
```
feat(agents): add contrarian analysis to skeptic agent
fix(rag): handle empty document chunks gracefully
docs(readme): add architecture diagram
test(api): add integration tests for analysis endpoint
```

---

## Pull Request Requirements

Every PR must meet the following criteria before merge:

- [ ] **Linked issue** -- reference the issue number (e.g., `Closes #42`)
- [ ] **Tests pass** -- all existing and new tests must pass (`poetry run pytest`)
- [ ] **Lint clean** -- no ruff or eslint violations
- [ ] **Type-check clean** -- `poetry run mypy app/` and `npm run type-check` pass
- [ ] **New tests** -- any new feature or bug fix includes corresponding tests
- [ ] **Documentation** -- update relevant docs if behavior changes

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- Bullet list of specific changes

## Testing
How you tested this (unit tests, manual verification, etc.)

## Related Issues
Closes #XX
```

---

## Code Style

### Python (backend)

- **Formatter/Linter:** [Ruff](https://docs.astral.sh/ruff/) (replaces black, isort, flake8)
- **Type checking:** [mypy](https://mypy.readthedocs.io/) in strict mode
- **Line length:** 100 characters
- **Docstrings:** Google style on all public functions and classes
- **Type hints:** Required on all function signatures
- **Async:** All I/O-bound operations must use async/await

```bash
# Check and auto-fix
poetry run ruff check --fix .
poetry run ruff format .
poetry run mypy app/
```

### TypeScript (frontend)

- **Linter:** ESLint with Next.js config
- **Strict mode:** No `any` types -- use `unknown` with type guards
- **Components:** Server components by default; `"use client"` only when required

```bash
cd frontend
npm run lint
npm run type-check
```

---

## Testing

### Running tests

```bash
# All tests
poetry run pytest

# Unit tests only
poetry run pytest -m unit

# Integration tests (requires Docker services)
poetry run pytest -m integration

# With coverage report
poetry run pytest --cov=app --cov-report=html
```

### Test guidelines

- **Unit tests** mock all external services (database, Neo4j, Redis, LLM APIs).
- **Integration tests** use Docker containers for real service dependencies.
- **Agent tests** use recorded LLM responses (cassettes) for deterministic results.
- Minimum coverage target: **80%** for business logic modules.
- Test files mirror the source structure with a `test_` prefix.

---

## Review Process

1. Submit your PR against `main`.
2. At least **one maintainer approval** is required before merge.
3. CI must pass (lint, type-check, tests).
4. Reviewers may request changes -- address all feedback before re-requesting review.
5. Squash-merge is the default merge strategy.

---

## Reporting Issues

When filing an issue, please include:

- **Description** of the problem or feature request
- **Steps to reproduce** (for bugs)
- **Expected vs. actual behavior** (for bugs)
- **Environment** (OS, Python version, Node version, Docker version)

---

## Code of Conduct

Be respectful, constructive, and collaborative. We are building something meaningful -- treat every contributor's time and ideas with care.
