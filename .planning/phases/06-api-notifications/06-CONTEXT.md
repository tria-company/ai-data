# Phase 6: API & Notifications - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

REST API endpoints for triggering scraping asynchronously (202 Accepted with jobId), monitoring job progress and status, and listing/filtering jobs. Email notification via Resend when no accounts with valid cookies are available and a job is re-queued with 30-minute delay.

</domain>

<decisions>
## Implementation Decisions

### API Design
- **D-01:** `POST /api/scrape` replaces the current synchronous SSE endpoint with an async version. Same payload `{ accountId, targetUsernames, projetoId }`. Returns `202 Accepted` with `{ jobId, status: 'queued' }`. `accountId` is optional — if omitted, worker auto-selects via round-robin.
- **D-02:** `GET /api/jobs/:id` returns full status with progress details: `{ jobId, status (queued|active|completed|failed), progress (percentage + current stage), result (when completed), error (if failed), createdAt, finishedAt }`.
- **D-03:** `GET /api/jobs` returns filtered list of jobs by `projetoId` and/or `status` query params.

### Email Notifications
- **D-04:** Email sent once per job that hits "no accounts available" and gets re-queued with 30-minute delay. The 30min delay already prevents email spam.
- **D-05:** Email sent via Resend SDK. Recipient is a fixed email from `ALERT_EMAIL` env variable in `.env`.
- **D-06:** Email content includes: which job failed, which accounts were tried and why they failed, instructions to fix (link to login page from Phase 7, or manual cookie import).

### Job Lifecycle
- **D-07:** Job data lives in Redis only via BullMQ. Completed jobs kept with 24h TTL (configurable). Scraped data is already persisted to Supabase by workers — no need for separate job persistence table.
- **D-08:** Job progress reported via BullMQ `job.updateProgress()`. Progress includes percentage and current stage (e.g., "extracting bio", "processing posts 3/10").

### Backward Compatibility
- **D-09:** Current synchronous SSE `/api/scrape` is fully replaced by the new async 202 version. No backward compatibility layer. Frontend will poll `GET /api/jobs/:id` instead of streaming.

### Prior Decisions (from Phases 4-5)
- **D-10:** BullMQ queues `profile-scrape` and `post-details` already defined in `lib/queue.ts`
- **D-11:** Workers already implement account selection, cookie fallback, and rate limiting (`lib/account-selector.ts`)
- **D-12:** When no accounts available, workers re-queue job with 30min delay (Phase 5 D-06) — this is the trigger point for email notification
- **D-13:** Single `.env` shared by all containers via `env_file`

### Claude's Discretion
- Next.js API route structure (e.g., `app/api/jobs/[id]/route.ts`)
- How to integrate Resend SDK (direct call vs utility wrapper)
- BullMQ job TTL configuration values
- Error response format and HTTP status codes for edge cases
- Whether to add Resend to existing worker code or create a notification utility

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing API Routes
- `app/api/scrape/route.ts` — Current synchronous SSE scrape endpoint (TO BE REPLACED)
- `app/api/accounts/list/route.ts` — Account listing pattern
- `app/api/projetos/list/route.ts` — Project listing pattern

### Queue & Worker Infrastructure (Phase 5)
- `lib/queue.ts` — BullMQ queue definitions (profileScrapeQueue, postDetailsQueue, connection)
- `lib/account-selector.ts` — Round-robin account selection with Redis rate limiting
- `workers/profile-worker.ts` — Profile scrape worker (enqueues post-details jobs)
- `workers/post-worker.ts` — Post details worker

### Infrastructure (Phase 4)
- `docker-compose.yml` — Service definitions (app, redis, browserless, profile-worker, post-worker)
- `.env` — Environment variables (will add ALERT_EMAIL, RESEND_API_KEY)

### Database Schema
- `supabase_schema.sql` — All tables including scrapper_accounts (cookie_valid, is_active, last_used_at)

### Planning
- `.planning/REQUIREMENTS.md` — API-01, API-02, API-03, ACCT-03
- `.planning/ROADMAP.md` — Phase 6 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `profileScrapeQueue.add()` — Already available to enqueue profile-scrape jobs from API
- `lib/queue.ts` exports `connection` for creating BullMQ Job instances to query status
- Next.js API route pattern at `app/api/` with request/response handling
- `lib/supabase.ts` — Supabase client (lazy Proxy pattern) for any needed queries

### Established Patterns
- API routes use `NextResponse.json()` for JSON responses
- Current `/api/scrape` already accepts `{ accountId, targetUsernames, projetoId }` — same payload structure
- Error handling returns `{ error: message }` with appropriate HTTP status

### Integration Points
- New `/api/scrape` enqueues to `profileScrapeQueue` instead of calling `scrapeAccounts()` directly
- New `/api/jobs/[id]` reads from BullMQ job state via `Queue.getJob(id)`
- New `/api/jobs` lists jobs from BullMQ queue via `Queue.getJobs()`
- Email notification integrates into the "no accounts available" code path in workers

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Next.js API routes and Resend integration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-api-notifications*
*Context gathered: 2026-04-06*
