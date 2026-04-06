---
phase: 06-api-notifications
plan: 01
subsystem: api
tags: [bullmq, rest-api, async, queue, job-status]

requires:
  - phase: 05-workers
    provides: BullMQ queue definitions and worker infrastructure
provides:
  - Async POST /api/scrape returning 202 with jobIds
  - GET /api/jobs/:id for single job status polling
  - GET /api/jobs for filtered job listing
  - Queue TTL defaults (24h completed, 7d failed)
affects: [06-api-notifications, frontend-scrape-ui]

tech-stack:
  added: []
  patterns: [async-202-pattern, job-polling-api, queue-ttl-defaults]

key-files:
  created:
    - app/api/jobs/[id]/route.ts
    - app/api/jobs/route.ts
  modified:
    - lib/queue.ts
    - app/api/scrape/route.ts

key-decisions:
  - "accountId made optional in POST /api/scrape -- worker auto-selects via round-robin if omitted"
  - "Job list optimization: single-status queries infer state from BullMQ type bucket, multi-status uses Promise.all"

patterns-established:
  - "Async 202 pattern: POST enqueues jobs, returns jobIds for polling"
  - "Job status endpoint returns progress, result, error, timestamps"

requirements-completed: [API-01, API-02, API-03]

duration: 2min
completed: 2026-04-06
---

# Phase 06 Plan 01: Async API Endpoints Summary

**Async 202 scrape endpoint with BullMQ queue TTL and job status/listing REST APIs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T20:30:56Z
- **Completed:** 2026-04-06T20:33:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced synchronous SSE `/api/scrape` with async 202 pattern backed by BullMQ
- Created job status endpoint (`GET /api/jobs/:id`) with full progress, result, and error details
- Created job listing endpoint (`GET /api/jobs`) with projetoId and status filters
- Configured queue TTL defaults: 24h/200 for completed, 7d/500 for failed jobs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add queue TTL defaults and replace /api/scrape with async 202 endpoint** - `c0e3f33` (feat)
2. **Task 2: Create GET /api/jobs/[id] and GET /api/jobs endpoints** - `c92f3fb` (feat)

## Files Created/Modified
- `lib/queue.ts` - Added defaultJobOptions with removeOnComplete/removeOnFail TTL config
- `app/api/scrape/route.ts` - Full replacement: SSE streaming to async 202 with queue enqueue
- `app/api/jobs/[id]/route.ts` - Single job status query with Next.js 15+ async params
- `app/api/jobs/route.ts` - Job listing with projetoId/status filters and state inference optimization

## Decisions Made
- accountId made optional in POST /api/scrape (worker auto-selects via round-robin if omitted)
- Job list optimization: when filtering by single status, state is inferred from BullMQ type bucket (no extra Redis calls); when listing all types, Promise.all resolves states in parallel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all endpoints are fully wired to BullMQ queue infrastructure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three API endpoints ready for frontend integration
- Job polling infrastructure available for notification system (plan 06-02)
- Workers from Phase 05 will process enqueued jobs and update progress

## Self-Check: PASSED

- All 4 files verified present on disk
- Both task commits verified in git log (c0e3f33, c92f3fb)

---
*Phase: 06-api-notifications*
*Completed: 2026-04-06*
