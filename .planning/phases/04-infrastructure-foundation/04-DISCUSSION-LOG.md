# Phase 4: Infrastructure Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 04-infrastructure-foundation
**Areas discussed:** Environment config, Bull Board integration, Dev vs Prod parity, Redis persistence

---

## Environment Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Single .env file | All containers share one .env file at the root. Docker Compose loads it via env_file directive. | ✓ |
| Separate .env per service | Each service gets its own .env (app.env, worker.env). More isolation but more files to manage. | |
| You decide | Claude picks the best approach | |

**User's choice:** Single .env file (Recommended)
**Notes:** Extends existing .env with Redis URL and new variables.

---

## Bull Board Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Route inside app | Mount Bull Board at /admin/queues inside Next.js using @bull-board/next-adapter. | ✓ |
| Separate container | Standalone Bull Board container on its own port. | |
| You decide | Claude picks based on simplicity | |

**User's choice:** Route inside app (Recommended)
**Notes:** One less container to manage, shares auth if added later.

---

## Dev vs Prod Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Single compose + overrides | One docker-compose.yml for prod. docker-compose.override.yml for dev extras. | ✓ |
| Single file only | One docker-compose.yml for everything. | |
| Separate files | docker-compose.dev.yml and docker-compose.prod.yml. | |

**User's choice:** Single compose + overrides (Recommended)
**Notes:** Standard Docker override pattern with dev extras for hot-reload and debug ports.

---

## Redis Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral | Redis data lost on restart. Jobs are transient and can be re-triggered. | ✓ |
| Persistent with volume | Mount Docker volume for Redis data. Jobs survive restarts. | |
| You decide | Claude picks based on use case | |

**User's choice:** Ephemeral (Recommended)
**Notes:** Simpler setup, no backup concerns. Scraping jobs can be re-triggered.

---

## Claude's Discretion

- Dockerfile optimization (multi-stage builds, layer caching)
- Port assignments for services
- Healthcheck configuration
- Network setup between containers

## Deferred Ideas

None — discussion stayed within phase scope.
