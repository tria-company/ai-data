# Phase 5: Queue System & Workers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 05-queue-system-workers
**Areas discussed:** Worker architecture, Account selection logic, Rate limiting strategy

---

## Worker Architecture

### How should workers run in Docker?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate containers | One container for profile-worker, another for post-worker. Independent scaling and restart. | ✓ |
| Single worker container | One container runs both workers in the same process. | |
| You decide | Claude picks | |

**User's choice:** Separate containers (Recommended)

### How should workers connect to the browser?

| Option | Description | Selected |
|--------|-------------|----------|
| Browserless WebSocket | Connect to shared Browserless container via ws://browserless:3000 | ✓ |
| Each worker has its own Chromium | Install Chromium in each worker container | |
| You decide | Claude picks | |

**User's choice:** Browserless WebSocket (Recommended)

---

## Account Selection Logic

### How should workers pick which account to use?

| Option | Description | Selected |
|--------|-------------|----------|
| Round-robin + fallback | Pick account with oldest last_used_at where cookie_valid=true and is_active=true | ✓ |
| Random selection + fallback | Randomly pick from valid accounts | |
| You decide | Claude picks | |

**User's choice:** Round-robin + fallback (Recommended)

### Cookie failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Retry in same job | Mark invalid, pick next account, retry without re-queuing | ✓ |
| Re-queue the job | Mark invalid, put job back in queue for another worker | |

**User's choice:** Retry in same job (Recommended)

---

## Rate Limiting Strategy

### How should rate limiting work?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-account delay | Each account waits ~30s between requests. Track in Redis. Multiple accounts parallel. | ✓ |
| Global fixed rate | Global ~2 req/min regardless of accounts. | |
| You decide | Claude picks | |

**User's choice:** Per-account delay (Recommended)

---

## Claude's Discretion

- Worker entry point file structure
- Worker Dockerfile
- How to refactor browser.ts for Browserless support
- Concurrency settings per worker
- Job progress reporting

## Deferred Ideas

None — discussion stayed within phase scope.
