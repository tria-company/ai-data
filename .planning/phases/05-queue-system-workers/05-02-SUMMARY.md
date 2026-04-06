---
phase: 05-queue-system-workers
plan: 02
subsystem: infra
tags: [bullmq, redis, workers, puppeteer, docker, queue]

requires:
  - phase: 05-01
    provides: "getBrowser, selectAccount, queue definitions, Dockerfile.worker, encryption"
provides:
  - "Profile scrape worker (bio, highlights, posts extraction + post-details enqueueing)"
  - "Post details worker (likes, comments, video, carousel extraction)"
  - "Docker Compose services for both workers"
affects: [05-03, api-endpoints, deployment]

tech-stack:
  added: []
  patterns: ["Account selection loop with cookie fallback within single job", "BullMQ Worker with rate limiter and concurrency=1", "browser.close() in finally block for Browserless cleanup"]

key-files:
  created:
    - workers/profile-worker.ts
    - workers/post-worker.ts
  modified:
    - docker-compose.yml

key-decisions:
  - "Workers decompose scrapeAccounts() into per-profile and per-post units"
  - "Account selection loop tries all accounts within same job before re-queueing"
  - "30-minute delay re-queue when no accounts available"

patterns-established:
  - "Worker pattern: account loop -> cookie setup -> browser work in try/finally -> close"
  - "Post enqueueing: profile worker bulk-adds post-details jobs after extracting post list"
  - "Cookie sanitization: identical logic in both workers matching scraper.ts pattern"

requirements-completed: [QUEUE-01, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05, ACCT-01, ACCT-02, ACCT-04]

duration: 3min
completed: 2026-04-06
---

# Phase 05 Plan 02: Workers Summary

**BullMQ profile-scrape and post-details workers with round-robin account selection, cookie fallback, exponential retry, and Docker Compose services**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T19:50:16Z
- **Completed:** 2026-04-06T19:53:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Profile worker extracts bio, highlights, posts and bulk-enqueues post-details jobs
- Post worker extracts likes, comments, video URLs, and carousel images per post
- Both workers use selectAccount() round-robin with cookie fallback in same job
- Docker Compose now has 5 services: app, redis, browserless, profile-worker, post-worker

## Task Commits

Each task was committed atomically:

1. **Task 1: Create profile-worker.ts and post-worker.ts** - `b817c41` (feat)
2. **Task 2: Add worker services to docker-compose.yml** - `b4d4dfb` (feat)

## Files Created/Modified
- `workers/profile-worker.ts` - Profile scrape worker with bio/highlights/posts extraction and post-details job enqueueing
- `workers/post-worker.ts` - Post details worker with likes/comments/video/carousel extraction
- `docker-compose.yml` - Added profile-worker and post-worker services using Dockerfile.worker

## Decisions Made
- Workers decompose the existing `scrapeAccounts()` flow into per-profile and per-post processing units
- Account selection loop tries all available accounts within the same job before giving up and re-queueing
- 30-minute delay on re-queue when no accounts are available (matching ACCT-04 requirement)
- Both workers share identical cookie decryption and sanitization logic from scraper.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workers are ready, API endpoints (Plan 03) can now enqueue jobs to these workers
- docker-compose.yml validates with all 5 services
- Profile worker automatically chains to post worker via postDetailsQueue.addBulk

---
*Phase: 05-queue-system-workers*
*Completed: 2026-04-06*

## Self-Check: PASSED
