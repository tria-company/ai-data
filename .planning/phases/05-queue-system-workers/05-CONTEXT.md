# Phase 5: Queue System & Workers - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Scraping jobs are processed asynchronously by dedicated BullMQ workers. Profile-scrape worker extracts bio, highlights, and post list, then enqueues individual post-details jobs. Post-details worker extracts likes, comments, video, and carousel per post. Workers automatically select accounts with fallback, retry failed jobs, and respect Instagram rate limits.

</domain>

<decisions>
## Implementation Decisions

### Worker Architecture
- **D-01:** Separate Docker containers for profile-worker and post-worker. Each runs a standalone Node.js process with BullMQ Worker class. Added as services in docker-compose.yml. Independent restart and future scaling.
- **D-02:** Workers connect to the shared Browserless container via WebSocket (`ws://browserless:3000`). No local Chromium installed in worker images. Browserless manages browser instances and concurrency.
- **D-03:** Workers reuse existing `lib/scraper.ts` and `lib/extraction.ts` logic. The `lib/browser.ts` must be updated to support connecting via Browserless WebSocket endpoint instead of local Chrome.

### Account Selection
- **D-04:** Round-robin selection by `last_used_at` ascending. Only accounts with `cookie_valid=true` AND `is_active=true` are eligible. Update `last_used_at` on each use.
- **D-05:** On cookie failure mid-scrape, worker marks account `cookie_valid=false`, increments `failed_attempts`, and retries with the next valid account in the SAME job (no re-queue). Only re-queues if ALL accounts are exhausted.
- **D-06:** When no accounts available, job re-queued with 30-minute delay (ACCT-04). This triggers email notification in Phase 6.

### Rate Limiting
- **D-07:** Per-account rate limiting. Each account waits ~30s between requests. Track `last_request_at` per account in Redis. Multiple accounts can work in parallel since Instagram limits are per-account.
- **D-08:** BullMQ's built-in rate limiter for queue-level throttling as a safety net.

### Retry Logic
- **D-09:** BullMQ exponential backoff for failed jobs. Default: 3 retries, delays of 30s, 60s, 120s.

### Prior Decisions (from Phase 4)
- **D-10:** BullMQ queues `profile-scrape` and `post-details` already defined in `lib/queue.ts` with Redis connection
- **D-11:** Single `.env` shared by all containers via `env_file`
- **D-12:** Browserless container available at `ws://browserless:3000`

### Claude's Discretion
- Worker entry point file structure (e.g., `workers/profile-worker.ts`, `workers/post-worker.ts`)
- Worker Dockerfile (can share the app Dockerfile or have its own)
- How to refactor `lib/browser.ts` to support both local Chrome and Browserless WebSocket
- Concurrency settings per worker
- Job progress reporting (BullMQ `job.updateProgress`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Scraping Logic
- `lib/scraper.ts` — Main scraping orchestration (scrapeAccounts function, login, per-target scraping loop)
- `lib/extraction.ts` — DOM extraction functions (extractBio, extractHighlights, extractPostsData, extractVideoUrl, extractCarouselImages, extractPostLikes, extractPostComments)
- `lib/browser.ts` — Browser launch logic (currently uses @sparticuz/chromium, needs Browserless support)
- `lib/encryption.ts` — Cookie encryption/decryption
- `lib/supabase.ts` — Supabase client (lazy-initialized with Proxy)

### Infrastructure (Phase 4)
- `lib/queue.ts` — BullMQ queue definitions (profileScrapeQueue, postDetailsQueue, connection export)
- `docker-compose.yml` — Current service definitions (app, redis, browserless)
- `.env` — Environment variables including REDIS_URL and BROWSERLESS_WS_ENDPOINT

### Database Schema
- `supabase_schema.sql` — All tables: scrapper_accounts, scrappers_contents, post_likes, post_comments, profile_bio, profile_highlights

### Planning
- `.planning/REQUIREMENTS.md` — QUEUE-01..05, ACCT-01, ACCT-02, ACCT-04
- `.planning/ROADMAP.md` — Phase 5 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scrapeAccounts()` in scraper.ts — orchestrates the full scraping flow for multiple targets. Workers will need to decompose this into per-profile and per-post units.
- `extractBio()`, `extractHighlights()`, `extractPostsData()` — profile-level extraction (for profile-scrape worker)
- `extractPostLikes()`, `extractPostComments()`, `extractVideoUrl()`, `extractCarouselImages()` — post-level extraction (for post-details worker)
- `encrypt()` / `decrypt()` — cookie handling, shared by workers
- `connection` export from `lib/queue.ts` — Redis connection config for BullMQ Workers

### Established Patterns
- `scraper.ts` currently runs synchronously within an HTTP request. Workers will refactor this into async job processing.
- Logging uses `onLog` callback pattern (SSE streaming). Workers may need different logging (stdout/Bull Board).
- `browser.ts` uses `@sparticuz/chromium` for Vercel and local Chrome fallback. Needs Browserless WebSocket mode.

### Integration Points
- Workers import from `lib/` (queue, scraper logic, supabase, encryption)
- Workers added as services in `docker-compose.yml` referencing the same `.env`
- Profile worker enqueues jobs to `postDetailsQueue` after extracting post list
- Account selection queries `scrapper_accounts` table via Supabase

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for BullMQ worker implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-queue-system-workers*
*Context gathered: 2026-04-06*
