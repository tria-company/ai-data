---
phase: 05-queue-system-workers
verified: 2026-04-06T20:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 5: Queue System & Workers Verification Report

**Phase Goal:** Scraping jobs are processed asynchronously by dedicated workers with automatic account selection, retry logic, and Instagram rate-limit compliance
**Verified:** 2026-04-06T20:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A profile-scrape job extracts bio, highlights, and post list, then automatically enqueues individual post-details jobs | VERIFIED | `workers/profile-worker.ts` calls `extractBio`, `extractHighlights`, `scrollToBottom`, `extractPostsData`, then `postDetailsQueue.addBulk(postJobs)` (lines 117-218) |
| 2 | A post-details job extracts likes, comments, video URL, and carousel images for a single post | VERIFIED | `workers/post-worker.ts` calls `extractPostLikes`, `extractPostComments`, `extractVideoUrl`, `extractCarouselImages` (lines 110-208) |
| 3 | Workers automatically pick the next available account via round-robin and fall back to the next account if cookies are invalid | VERIFIED | Both workers have account selection loop: `selectAccount()` -> try scrape -> `isCookieError` -> `markAccountInvalid` -> `selectAccount()` again. `selectAccount()` in `lib/account-selector.ts` orders by `last_used_at ASC NULLS FIRST` (line 39) |
| 4 | Failed jobs are retried with exponential backoff, and jobs without available accounts are re-queued with a 30-minute delay | VERIFIED | Post-details jobs enqueued with `attempts: 3, backoff: { type: 'exponential', delay: 30000 }` (profile-worker.ts lines 211-213). No-account re-queue: `delay: 30 * 60 * 1000` in both workers (profile-worker.ts line 49, post-worker.ts line 50) |
| 5 | Workers throttle requests to respect Instagram rate limits (~2 requests/min per account) | VERIFIED | Worker `limiter: { max: 2, duration: 60000 }` in both workers (profile-worker.ts line 239, post-worker.ts line 229). Per-account 30s Redis cooldown via `rate:account:{id}` key with `'EX', 30` in account-selector.ts (line 60) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/browser.ts` | getBrowser() with connect+launch dual mode | VERIFIED | `getBrowser()` exported (line 84), connects via `puppeteer.connect({ browserWSEndpoint })` when env set (line 89), falls back to `launchBrowser()` (line 95). Original `launchBrowser()` preserved (line 31) |
| `lib/account-selector.ts` | Account selection with round-robin and rate limiting | VERIFIED | 129 lines, exports `selectAccount`, `markAccountInvalid`, `isCookieError`, `isNoAccountsAvailable`. Uses ioredis with `maxRetriesPerRequest: null`. Relative import `./supabase` (line 2) |
| `workers/profile-worker.ts` | Profile scrape worker with account selection and post enqueueing | VERIFIED | 255 lines, `new Worker('profile-scrape', ...)` (line 236), full bio/highlights/posts extraction, `postDetailsQueue.addBulk` (line 217), `browser.close()` in finally (line 231), graceful shutdown (lines 246-252) |
| `workers/post-worker.ts` | Post details worker with account selection | VERIFIED | 245 lines, `new Worker('post-details', ...)` (line 226), likes/comments/video/carousel extraction, `browser.close()` in finally (line 221), graceful shutdown (lines 236-242) |
| `Dockerfile.worker` | Lightweight worker container image | VERIFIED | 16 lines, `FROM node:20-alpine`, copies only `lib/` and `workers/`, no `next build`, uses `npx tsx` |
| `supabase_schema.sql` | last_used_at column on scrapper_accounts | VERIFIED | `ADD COLUMN IF NOT EXISTS last_used_at` and `idx_scrapper_accounts_round_robin` partial index present |
| `docker-compose.yml` | Worker services using Dockerfile.worker | VERIFIED | `profile-worker` and `post-worker` services present, both use `Dockerfile.worker`, `env_file: .env`, `depends_on: redis (healthy) + browserless (started)`, `networks: scraper-net`, `restart: unless-stopped` |
| `package.json` | ioredis and tsx dependencies | VERIFIED | `ioredis: ^5.10.1` in dependencies, `tsx: ^4.21.0` in devDependencies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/account-selector.ts` | `lib/supabase.ts` | `import { supabase }` | WIRED | Line 2: `import { supabase } from './supabase'`, queries `scrapper_accounts` table (line 35) |
| `lib/account-selector.ts` | redis | ioredis for rate limiting | WIRED | Line 1: `import Redis from 'ioredis'`, uses `rate:account:${account.id}` key pattern (lines 54, 60) |
| `workers/profile-worker.ts` | `lib/account-selector.ts` | import selectAccount, markAccountInvalid, isCookieError | WIRED | Line 4: all three imported and used in account selection loop (lines 31-45) |
| `workers/profile-worker.ts` | `lib/queue.ts` | import postDetailsQueue, connection | WIRED | Line 2: `postDetailsQueue` used for `addBulk` (line 217), `connection` used in Worker constructor (line 237) |
| `workers/profile-worker.ts` | `lib/browser.ts` | import getBrowser | WIRED | Line 3: `getBrowser` imported, called at line 72 |
| `workers/post-worker.ts` | `lib/account-selector.ts` | import selectAccount, markAccountInvalid, isCookieError | WIRED | Line 4: all three imported and used in account selection loop (lines 32-46) |
| `docker-compose.yml` | `Dockerfile.worker` | build dockerfile reference | WIRED | Lines 47 and 63: `dockerfile: Dockerfile.worker` for both worker services |

All imports use relative paths (`../lib/`) -- no `@/` path aliases in workers, compatible with tsx execution.

### Data-Flow Trace (Level 4)

Not applicable -- workers are background processors, not UI components rendering dynamic data. They read from Supabase, process via Puppeteer/extraction functions, and write back to Supabase. Data flow is inherent in the scraping logic already traced in key links.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Docker Compose validates with all 5 services | `docker compose config --services` | app, browserless, post-worker, profile-worker, redis | PASS |
| Workers use relative imports (no @/ aliases) | grep for `@/` in workers/ | No matches found | PASS |
| No TODO/FIXME/PLACEHOLDER in worker code | grep in workers/ | No matches found | PASS |
| No empty return stubs in workers | grep `return null\|return {}\|return []` in workers/ | No matches found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUEUE-01 | 05-02 | Fila `profile-scrape` processa extracao de bio, highlights e lista de posts | SATISFIED | `profile-worker.ts` processes `profile-scrape` queue with full extraction logic |
| QUEUE-02 | 05-02 | Fila `post-details` processa extracao de likes, comments, video e carousel | SATISFIED | `post-worker.ts` processes `post-details` queue with likes/comments/video/carousel |
| QUEUE-03 | 05-02 | Worker de profile enfileira posts individuais na fila `post-details` | SATISFIED | `profile-worker.ts` line 217: `postDetailsQueue.addBulk(postJobs)` |
| QUEUE-04 | 05-02 | Workers possuem retry automatico com backoff exponencial | SATISFIED | Exponential backoff: `attempts: 3, backoff: { type: 'exponential', delay: 30000 }` |
| QUEUE-05 | 05-01, 05-02 | Rate limiting nos workers respeita limites do Instagram (~2 requests/min) | SATISFIED | Worker limiter `max: 2, duration: 60000` + per-account 30s Redis cooldown |
| ACCT-01 | 05-01 | Sistema seleciona automaticamente conta com cookie valido (round-robin) | SATISFIED | `selectAccount()` queries `cookie_valid=true, is_active=true` ordered by `last_used_at ASC NULLS FIRST` |
| ACCT-02 | 05-01 | Se cookie falha, marca conta como cookie_valid=false e tenta proxima | SATISFIED | `markAccountInvalid()` sets `cookie_valid=false`, increments `failed_attempts`. Workers loop to next account on `isCookieError()` |
| ACCT-04 | 05-01, 05-02 | Job volta para fila com delay de 30min quando sem conta disponivel | SATISFIED | Both workers re-queue with `delay: 30 * 60 * 1000` when `selectAccount()` returns null |

No orphaned requirements found -- all 8 requirement IDs from ROADMAP.md Phase 5 are covered by the two plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

### Human Verification Required

### 1. Worker Execution in Docker

**Test:** Run `docker compose up profile-worker post-worker` and verify workers start and connect to Redis
**Expected:** Workers print "Started, waiting for jobs..." and do not crash
**Why human:** Requires Docker environment running with Redis and Browserless services

### 2. End-to-End Job Processing

**Test:** Enqueue a profile-scrape job via Bull Board or direct Redis command, observe worker processing
**Expected:** Profile worker extracts data and enqueues post-details jobs; post worker processes them
**Why human:** Requires live Instagram account cookies and network access to Instagram

### 3. Cookie Fallback Behavior

**Test:** Enqueue a job with an account that has invalid cookies
**Expected:** Worker marks account invalid, selects next account, continues processing
**Why human:** Requires multiple accounts in database with varying cookie states

---

_Verified: 2026-04-06T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
