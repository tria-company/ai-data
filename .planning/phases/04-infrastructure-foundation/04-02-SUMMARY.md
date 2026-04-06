---
phase: 04-infrastructure-foundation
plan: 02
subsystem: infra
tags: [bullmq, bull-board, redis, ioredis, express, docker, queue-monitoring]

requires:
  - phase: 04-01
    provides: Docker Compose with Redis and Browserless services, standalone Next.js output
provides:
  - BullMQ queue definitions (profile-scrape, post-details) with shared Redis connection
  - Bull Board UI mounted at /api/admin/queues for queue monitoring
  - Docker Compose dev override with hot-reload and debug port
affects: [05-queue-workers, 06-api-endpoints]

tech-stack:
  added: [bullmq, "@bull-board/api", "@bull-board/express", ioredis, express]
  patterns: [express-to-nextjs-adapter, catch-all-route-handler, queue-factory-pattern]

key-files:
  created:
    - lib/queue.ts
    - lib/bullboard.ts
    - "app/api/admin/queues/[[...slug]]/route.ts"
    - app/admin/queues/page.tsx
    - docker-compose.override.yml
  modified:
    - package.json
    - next.config.ts

key-decisions:
  - "Used @bull-board/express adapter instead of non-existent @bull-board/next-adapter"
  - "Used catch-all route [[...slug]] with Express-to-NextResponse bridge for Bull Board"
  - "Added express to serverExternalPackages alongside ioredis and bullmq"

patterns-established:
  - "Express adapter bridge: wrapping Express middleware in Next.js catch-all route handlers"
  - "Queue factory: centralized queue definitions in lib/queue.ts with shared connection config"

requirements-completed: [INFRA-04, INFRA-01]

duration: 2min
completed: 2026-04-06
---

# Phase 04 Plan 02: BullMQ and Bull Board Setup Summary

**BullMQ queue definitions (profile-scrape, post-details) with Bull Board monitoring UI at /api/admin/queues and docker-compose dev override for hot-reload**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T19:04:52Z
- **Completed:** 2026-04-06T19:07:07Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed BullMQ, Bull Board, ioredis, and Express with queue factory in lib/queue.ts
- Mounted Bull Board UI at /api/admin/queues using Express adapter bridged to Next.js route handler
- Created docker-compose.override.yml with volume mounts for hot-reload and port 9229 for Node.js debugging

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create queue/Bull Board modules** - `e066e15` (feat)
2. **Task 2: Create Bull Board route handler, admin page, and dev compose override** - `65337df` (feat)

## Files Created/Modified
- `lib/queue.ts` - BullMQ queue factory with profile-scrape and post-details queues, shared Redis connection
- `lib/bullboard.ts` - Bull Board setup with Express adapter, registers both queues
- `app/api/admin/queues/[[...slug]]/route.ts` - Catch-all route handler bridging Express to Next.js Response
- `app/admin/queues/page.tsx` - Redirect page from /admin/queues to /api/admin/queues
- `docker-compose.override.yml` - Dev overrides with volume mounts, hot-reload, debug port
- `package.json` - Added bullmq, @bull-board/api, @bull-board/express, ioredis, express
- `next.config.ts` - Added ioredis, bullmq, express to serverExternalPackages

## Decisions Made
- Used `@bull-board/express` adapter instead of `@bull-board/next-adapter` (package does not exist on npm). Created an Express-to-NextResponse bridge in the catch-all route handler.
- Used catch-all route `[[...slug]]` to handle all Bull Board sub-routes (assets, API calls, etc.)
- Added `express` to serverExternalPackages to prevent webpack bundling issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @bull-board/next-adapter does not exist**
- **Found during:** Task 1 (npm install)
- **Issue:** The package `@bull-board/next-adapter` returned 404 from npm registry
- **Fix:** Used `@bull-board/express` adapter instead, created Express-to-NextResponse bridge in route handler
- **Files modified:** lib/bullboard.ts, app/api/admin/queues/[[...slug]]/route.ts, package.json
- **Verification:** Files created, packages installed successfully
- **Committed in:** e066e15 (Task 1), 65337df (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Adapter swap was necessary since the planned package does not exist. Express adapter is the most documented and stable alternative. No scope creep.

## Issues Encountered
None beyond the adapter package change documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Queue infrastructure ready for Phase 5 (workers can import from lib/queue.ts)
- Bull Board monitoring ready to show job status once workers start processing
- Dev workflow ready with docker-compose.override.yml for hot-reload development

## Known Stubs
None - all modules are fully wired with real queue connections.

---
*Phase: 04-infrastructure-foundation*
*Completed: 2026-04-06*

## Self-Check: PASSED
