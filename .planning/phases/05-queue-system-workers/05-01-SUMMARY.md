---
phase: 05-queue-system-workers
plan: 01
subsystem: infra
tags: [puppeteer, browserless, ioredis, redis, round-robin, docker, tsx, worker]

# Dependency graph
requires:
  - phase: 04-infrastructure-foundation
    provides: Docker Compose with Redis and Browserless services
provides:
  - getBrowser() with Browserless WebSocket connect + local Chrome fallback
  - selectAccount() with round-robin and 30s per-account Redis rate limiting
  - markAccountInvalid() for cookie failure handling
  - isCookieError() for Instagram login redirect detection
  - Dockerfile.worker for lightweight worker container image
  - last_used_at column on scrapper_accounts with partial index
affects: [05-02-queue-system-workers]

# Tech tracking
tech-stack:
  added: [ioredis, tsx]
  patterns: [dual-mode browser connection, round-robin account selection, per-account rate limiting via Redis]

key-files:
  created:
    - lib/account-selector.ts
    - Dockerfile.worker
    - workers/.gitkeep
  modified:
    - lib/browser.ts
    - supabase_schema.sql
    - package.json

key-decisions:
  - "getBrowser() added alongside existing launchBrowser() to avoid breaking scraper.ts imports"
  - "30s Redis TTL for per-account rate limiting matches Instagram rate limit strategy"
  - "Relative imports in account-selector.ts (./supabase) for worker tsx compatibility"

patterns-established:
  - "Dual-mode browser: getBrowser() for workers, launchBrowser() for existing code"
  - "Redis rate keys: rate:account:{id} with EX TTL for cooldown"
  - "Worker Dockerfile: node:20-alpine with only lib/ and workers/, no Next.js build"

requirements-completed: [ACCT-01, ACCT-02, ACCT-04, QUEUE-05]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 5 Plan 1: Worker Foundation Summary

**Browser connection abstraction with Browserless WebSocket support, round-robin account selector with Redis rate limiting, and lightweight worker Dockerfile**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T19:45:14Z
- **Completed:** 2026-04-06T19:47:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- getBrowser() connects to Browserless via WebSocket or falls back to local Chrome launch
- selectAccount() implements round-robin selection with 30s per-account Redis rate limiting
- Dockerfile.worker creates lightweight container with only lib/ and workers/ (no Next.js build)
- Schema migration adds last_used_at column with partial index for efficient round-robin queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor browser.ts and create account-selector.ts** - `db5da7a` (feat)
2. **Task 2: Database migration, worker Dockerfile, and tsx install** - `afd4ff0` (feat)

## Files Created/Modified
- `lib/browser.ts` - Added getBrowser() with Browserless WebSocket connect + local fallback
- `lib/account-selector.ts` - New: round-robin account selection, rate limiting, cookie error detection
- `supabase_schema.sql` - Added last_used_at column and partial index for round-robin
- `Dockerfile.worker` - Lightweight worker image using node:20-alpine and tsx
- `package.json` - Added ioredis and tsx dependencies
- `workers/.gitkeep` - Placeholder for worker files (created by plan 05-02)

## Decisions Made
- getBrowser() added as new function alongside launchBrowser() to preserve backward compatibility with scraper.ts
- Used relative imports in account-selector.ts (./supabase instead of @/lib/supabase) for tsx worker compatibility
- 30s Redis TTL chosen for per-account rate limiting to match Instagram rate limit patterns
- markAccountInvalid() uses fallback approach (direct update if RPC not available) for robustness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed ioredis dependency**
- **Found during:** Task 1 (account-selector.ts creation)
- **Issue:** ioredis not in package.json, needed for Redis rate limiting in account-selector.ts
- **Fix:** Ran `npm install ioredis`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import resolves, package in dependencies
- **Committed in:** db5da7a (Task 1 commit)

**2. [Rule 2 - Missing Critical] Created workers/ directory**
- **Found during:** Task 2 (Dockerfile.worker creation)
- **Issue:** Dockerfile.worker COPY workers/ would fail without the directory existing
- **Fix:** Created workers/.gitkeep placeholder
- **Files modified:** workers/.gitkeep
- **Verification:** Directory exists, tracked by git
- **Committed in:** afd4ff0 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all functions are fully implemented with real Supabase and Redis calls.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- lib/browser.ts and lib/account-selector.ts ready for import by worker files in plan 05-02
- Dockerfile.worker ready for docker-compose integration
- Schema migration ready to be applied to Supabase
- workers/ directory ready for profile-worker.ts and post-worker.ts

---
*Phase: 05-queue-system-workers*
*Completed: 2026-04-06*
