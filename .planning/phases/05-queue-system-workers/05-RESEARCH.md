# Phase 5: Queue System & Workers - Research

**Researched:** 2026-04-06
**Domain:** BullMQ workers, Puppeteer + Browserless, async job processing
**Confidence:** HIGH

## Summary

This phase implements two BullMQ workers (profile-scrape and post-details) as separate Docker containers that connect to the shared Browserless instance via WebSocket. The existing scraping logic in `lib/scraper.ts` and `lib/extraction.ts` must be decomposed into per-profile and per-post processing units. Workers need automatic account selection with round-robin, cookie failure fallback, and per-account rate limiting via Redis.

The codebase already has BullMQ queues defined in `lib/queue.ts`, Redis and Browserless containers in `docker-compose.yml`, and all extraction functions in `lib/extraction.ts`. The main work is: (1) refactoring `lib/browser.ts` to support Browserless WebSocket connections, (2) creating worker entry points that decompose `scrapeAccounts()`, (3) implementing account selection and rate limiting logic, and (4) adding worker services to Docker Compose.

**Primary recommendation:** Build workers as standalone Node.js processes using `tsx` for TypeScript execution, reusing existing `lib/` modules. Workers connect to Browserless via `puppeteer.connect({ browserWSEndpoint })` instead of `puppeteer.launch()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Separate Docker containers for profile-worker and post-worker. Each runs a standalone Node.js process with BullMQ Worker class. Added as services in docker-compose.yml. Independent restart and future scaling.
- D-02: Workers connect to the shared Browserless container via WebSocket (`ws://browserless:3000`). No local Chromium installed in worker images. Browserless manages browser instances and concurrency.
- D-03: Workers reuse existing `lib/scraper.ts` and `lib/extraction.ts` logic. The `lib/browser.ts` must be updated to support connecting via Browserless WebSocket endpoint instead of local Chrome.
- D-04: Round-robin selection by `last_used_at` ascending. Only accounts with `cookie_valid=true` AND `is_active=true` are eligible. Update `last_used_at` on each use.
- D-05: On cookie failure mid-scrape, worker marks account `cookie_valid=false`, increments `failed_attempts`, and retries with the next valid account in the SAME job (no re-queue). Only re-queues if ALL accounts are exhausted.
- D-06: When no accounts available, job re-queued with 30-minute delay (ACCT-04). This triggers email notification in Phase 6.
- D-07: Per-account rate limiting. Each account waits ~30s between requests. Track `last_request_at` per account in Redis. Multiple accounts can work in parallel since Instagram limits are per-account.
- D-08: BullMQ's built-in rate limiter for queue-level throttling as a safety net.
- D-09: BullMQ exponential backoff for failed jobs. Default: 3 retries, delays of 30s, 60s, 120s.
- D-10: BullMQ queues `profile-scrape` and `post-details` already defined in `lib/queue.ts` with Redis connection.
- D-11: Single `.env` shared by all containers via `env_file`.
- D-12: Browserless container available at `ws://browserless:3000`.

### Claude's Discretion
- Worker entry point file structure (e.g., `workers/profile-worker.ts`, `workers/post-worker.ts`)
- Worker Dockerfile (can share the app Dockerfile or have its own)
- How to refactor `lib/browser.ts` to support both local Chrome and Browserless WebSocket
- Concurrency settings per worker
- Job progress reporting (BullMQ `job.updateProgress`)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUEUE-01 | Fila `profile-scrape` processa extracao de bio, highlights e lista de posts por perfil | Workers decompose `scrapeAccounts()` -- profile worker uses `extractBio()`, `extractHighlights()`, `extractPostsData()` |
| QUEUE-02 | Fila `post-details` processa extracao de likes, comments, video e carousel por post | Post-details worker uses `extractPostLikes()`, `extractPostComments()`, `extractVideoUrl()`, `extractCarouselImages()` |
| QUEUE-03 | Worker de profile enfileira posts individuais na fila `post-details` apos extrair lista | Profile worker calls `postDetailsQueue.addBulk()` after extracting post list |
| QUEUE-04 | Workers possuem retry automatico com backoff exponencial em caso de falha | BullMQ `attempts: 3` with `backoff: { type: 'exponential', delay: 30000 }` |
| QUEUE-05 | Rate limiting nos workers respeita limites do Instagram (~2 requests/min) | Per-account Redis key `rate:account:{id}` with 30s TTL + BullMQ worker limiter as safety net |
| ACCT-01 | Sistema seleciona automaticamente conta com cookie valido (round-robin por last_used_at) | Query `scrapper_accounts` WHERE `cookie_valid=true AND is_active=true` ORDER BY `last_used_at ASC NULLS FIRST` |
| ACCT-02 | Se cookie falha durante scraping, marca conta como cookie_valid=false e tenta proxima | Try/catch in worker processor, mark account, loop to next account in same job |
| ACCT-04 | Job volta para fila com delay de 30min quando sem conta disponivel | Re-add job to queue with `delay: 1800000` (30 min) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | 5.73.0 | Job queue and worker framework | Already installed, TypeScript-native, Redis-backed |
| puppeteer-core | 24.35.0 | Browser automation via Browserless | Already installed, supports `puppeteer.connect()` for remote browsers |
| ioredis | 5.10.1 | Redis client for rate limiting keys | Already installed, used by BullMQ internally |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | Run TypeScript workers directly without build step | Worker entry points in Docker |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsx | ts-node | tsx is faster (esbuild-based), simpler setup |
| Separate worker Dockerfile | Shared app Dockerfile | Separate is cleaner -- workers don't need Next.js build, only `lib/` and `node_modules` |

**Installation:**
```bash
npm install tsx
```

## Architecture Patterns

### Recommended Project Structure
```
workers/
  profile-worker.ts    # Profile scrape worker entry point
  post-worker.ts       # Post details worker entry point
lib/
  browser.ts           # Updated: support both launch() and connect()
  account-selector.ts  # NEW: round-robin account selection + rate limiting
  queue.ts             # Existing: queue definitions + connection export
  scraper.ts           # Existing: extraction orchestration (reused by workers)
  extraction.ts        # Existing: DOM extraction functions
  encryption.ts        # Existing: cookie encrypt/decrypt
  supabase.ts          # Existing: Supabase client
```

### Pattern 1: Browser Connection Abstraction
**What:** Refactor `lib/browser.ts` to support two modes: `launch` (local dev / Vercel) and `connect` (Browserless WebSocket).
**When to use:** Always -- workers use connect mode, existing app uses launch mode.
**Example:**
```typescript
// lib/browser.ts - updated
import puppeteer from 'puppeteer-core';

interface BrowserOptions {
  headless?: boolean;
  userDataDir?: string;
}

export async function getBrowser(options: BrowserOptions = {}) {
  const browserlessEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;

  if (browserlessEndpoint) {
    // Docker/Worker mode: connect to Browserless via WebSocket
    return await puppeteer.connect({
      browserWSEndpoint: browserlessEndpoint,
    });
  }

  // Existing launch logic for local dev / Vercel
  return await launchBrowser(options);
}
```
Source: https://docs.browserless.io/baas/connect-puppeteer

### Pattern 2: Account Selection with Rate Limiting
**What:** Query Supabase for eligible accounts, pick by oldest `last_used_at`, enforce per-account rate limit via Redis TTL key.
**When to use:** Every job processor call before starting browser work.
**Example:**
```typescript
// lib/account-selector.ts
import { supabase } from './supabase';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function selectAccount(): Promise<Account | null> {
  const { data: accounts } = await supabase
    .from('scrapper_accounts')
    .select('*')
    .eq('cookie_valid', true)
    .eq('is_active', true)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(10);

  if (!accounts || accounts.length === 0) return null;

  for (const account of accounts) {
    // Check per-account rate limit
    const rateLimitKey = `rate:account:${account.id}`;
    const isRateLimited = await redis.get(rateLimitKey);
    if (isRateLimited) continue;

    // Set rate limit (30s cooldown)
    await redis.set(rateLimitKey, '1', 'EX', 30);

    // Update last_used_at
    await supabase
      .from('scrapper_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', account.id);

    return account;
  }

  return null; // All accounts rate-limited
}
```

### Pattern 3: Worker with Account Fallback
**What:** Worker processor that tries accounts sequentially within a single job, only re-queuing when ALL accounts are exhausted.
**When to use:** Both profile-worker and post-worker processors.
**Example:**
```typescript
// workers/profile-worker.ts
import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';

const worker = new Worker('profile-scrape', async (job: Job) => {
  const { username, projetoId } = job.data;

  // Try accounts until one works
  let account = await selectAccount();
  while (account) {
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();
      // ... set cookies, scrape profile ...
      await browser.close();
      return result;
    } catch (error) {
      if (isCookieError(error)) {
        await markAccountInvalid(account.id);
        account = await selectAccount();
        continue;
      }
      throw error; // Non-cookie errors trigger BullMQ retry
    }
  }

  // No accounts available -- re-queue with 30min delay
  await profileScrapeQueue.add('profile-scrape', job.data, {
    delay: 30 * 60 * 1000, // 30 minutes
  });
  return { status: 'requeued', reason: 'no_accounts_available' };
}, {
  connection,
  concurrency: 1, // One job at a time per worker instance
  limiter: { max: 2, duration: 60000 }, // Safety net: max 2 jobs/min
});

worker.on('error', (err) => console.error('Worker error:', err));
```
Source: https://docs.bullmq.io/guide/workers

### Pattern 4: Profile Worker Enqueuing Post Jobs
**What:** After extracting post list, profile worker bulk-enqueues individual post-details jobs.
**When to use:** QUEUE-03 requirement.
**Example:**
```typescript
// Inside profile worker processor, after extracting posts
const postJobs = posts.map(post => ({
  name: 'post-details',
  data: {
    postId: post.postId,
    postUrl: post.postUrl,
    mediaType: post.mediaType,
    isCarousel: post.isCarousel,
    username,
    projetoId,
  },
  opts: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
  },
}));

await postDetailsQueue.addBulk(postJobs);
```

### Anti-Patterns to Avoid
- **Launching Chromium in worker containers:** Workers MUST use `puppeteer.connect()` to Browserless, never `puppeteer.launch()`. Workers have no local Chrome installed.
- **Single browser for entire job:** Close the browser connection after each profile/post. Browserless manages the lifecycle. Long-lived connections risk zombie browsers.
- **Re-queuing on every cookie failure:** D-05 says try the next account in the SAME job first. Only re-queue when ALL accounts are exhausted.
- **Missing error event handler:** BullMQ workers will stop processing if the `error` event has no handler. Always add `worker.on('error', ...)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue persistence | Custom Redis job tracking | BullMQ Queue + Worker | Handles retries, backoff, rate limiting, persistence natively |
| Exponential backoff | Custom setTimeout retry logic | BullMQ `backoff: { type: 'exponential' }` | Formula: `2^(attempts-1) * delay`. Built-in jitter support |
| Queue monitoring | Custom job status API | Bull Board (already installed in Phase 4) | Already set up at `/admin/queues` |
| Browser lifecycle | Custom browser pool | Browserless container | Manages concurrency, timeouts, cleanup automatically |

**Key insight:** BullMQ handles all the hard parts (persistence, retries, rate limiting, progress tracking). Workers are thin wrappers that call existing extraction functions.

## Common Pitfalls

### Pitfall 1: Missing `last_used_at` Column
**What goes wrong:** Account selection query fails because `last_used_at` doesn't exist in `scrapper_accounts`.
**Why it happens:** The schema SQL does not include this column. It was decided in CONTEXT.md (D-04) but never added.
**How to avoid:** Add `last_used_at` column migration BEFORE implementing account selection.
**Warning signs:** Supabase query returns empty results or errors on ORDER BY.

### Pitfall 2: Redis maxRetriesPerRequest
**What goes wrong:** BullMQ Worker throws "maxRetriesPerRequest must be null" error.
**Why it happens:** ioredis defaults `maxRetriesPerRequest` to 20, but BullMQ requires it to be `null` for blocking commands.
**How to avoid:** When creating ioredis connections for workers, always set `maxRetriesPerRequest: null`. The current `lib/queue.ts` uses plain host/port object (not ioredis instance), which BullMQ handles correctly.
**Warning signs:** Worker crashes on startup with Redis connection error.

### Pitfall 3: Worker TypeScript Execution in Docker
**What goes wrong:** Worker container can't run `.ts` files directly.
**Why it happens:** Node.js doesn't natively execute TypeScript. The app container uses Next.js build which handles TS, but workers are standalone.
**How to avoid:** Use `tsx` as the runner: `CMD ["npx", "tsx", "workers/profile-worker.ts"]`. Or compile with `tsc` first.
**Warning signs:** `SyntaxError: Cannot use import statement` in container logs.

### Pitfall 4: Browserless Concurrency Exhaustion
**What goes wrong:** Workers hang waiting for a browser connection.
**Why it happens:** Browserless is configured with `CONCURRENT=2`. If both slots are occupied, new connections queue.
**How to avoid:** Set worker concurrency to 1 per container. With 2 workers (profile + post), that exactly fills Browserless's 2 concurrent slots. Monitor and increase `CONCURRENT` if needed.
**Warning signs:** Jobs stuck in "active" state for extended periods.

### Pitfall 5: Browser Connection Not Closed
**What goes wrong:** Browserless runs out of connections, zombie browsers accumulate.
**Why it happens:** If worker crashes before `browser.close()`, the connection leaks.
**How to avoid:** Use try/finally to always close: `try { ... } finally { await browser.close(); }`. Browserless `TIMEOUT=120000` provides a safety net.
**Warning signs:** Browserless health check fails, memory usage climbs.

### Pitfall 6: tsconfig paths not resolved outside Next.js
**What goes wrong:** Workers using `@/*` path aliases fail to resolve imports.
**Why it happens:** `tsconfig.json` has `"paths": { "@/*": ["./*"] }` but `tsx` doesn't resolve these by default.
**How to avoid:** Use relative imports in worker files (`../lib/queue` instead of `@/lib/queue`), or configure `tsx` with `--tsconfig` flag.
**Warning signs:** `Cannot find module '@/lib/queue'` at worker startup.

## Code Examples

### Worker Dockerfile (Lightweight)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY lib/ ./lib/
COPY workers/ ./workers/
COPY tsconfig.json ./
ENV NODE_ENV=production
# Profile worker (override CMD in docker-compose per service)
CMD ["npx", "tsx", "workers/profile-worker.ts"]
```

### Docker Compose Worker Services
```yaml
  profile-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
      browserless:
        condition: service_started
    networks:
      - scraper-net
    restart: unless-stopped
    command: ["npx", "tsx", "workers/profile-worker.ts"]

  post-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
      browserless:
        condition: service_started
    networks:
      - scraper-net
    restart: unless-stopped
    command: ["npx", "tsx", "workers/post-worker.ts"]
```

### BullMQ Retry Configuration
```typescript
// When adding jobs (e.g., from API or profile worker)
await profileScrapeQueue.add('profile-scrape', {
  username: 'target_user',
  projetoId: 'uuid-here',
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 30000, // 30s base -> 30s, 60s, 120s
  },
});
```
Source: https://docs.bullmq.io/guide/retrying-failing-jobs

### Graceful Worker Shutdown
```typescript
// In worker entry point
async function shutdown() {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Database Migration: Add last_used_at
```sql
-- Migration: Add last_used_at to scrapper_accounts for round-robin selection
ALTER TABLE public.scrapper_accounts
  ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone NULL;

-- Index for efficient round-robin queries
CREATE INDEX IF NOT EXISTS idx_scrapper_accounts_last_used_at
  ON public.scrapper_accounts (last_used_at ASC NULLS FIRST)
  WHERE cookie_valid = true AND is_active = true;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous scraping in HTTP request | Async job queue with workers | This phase | Requests return immediately, jobs process in background |
| `puppeteer.launch()` with local Chrome | `puppeteer.connect()` to Browserless | This phase | Workers don't need Chrome installed, centralized browser management |
| Manual account selection in frontend | Automatic round-robin with fallback | This phase | No human intervention needed for account selection |

## Open Questions

1. **Browserless CONCURRENT setting**
   - What we know: Currently set to 2 in docker-compose. With 2 workers (profile + post), each at concurrency 1, this is exactly right.
   - What's unclear: If a profile job and post job run simultaneously, will Browserless handle both? Should we increase to 3 for headroom?
   - Recommendation: Start with CONCURRENT=2 and worker concurrency=1. Monitor in production and increase if jobs queue up.

2. **Cookie validation detection**
   - What we know: Worker needs to detect when cookies are invalid mid-scrape (D-05).
   - What's unclear: What does Instagram return when cookies are invalid? Login redirect? 401? Specific page content?
   - Recommendation: Check for redirect to login page (`/accounts/login/`) or presence of "Log in" text. The existing code already handles private accounts; add similar detection for invalid sessions.

3. **Job data for post-details**
   - What we know: Profile worker extracts post list and enqueues post-details jobs.
   - What's unclear: Should post-details jobs include the account ID used by the profile worker, or select their own?
   - Recommendation: Each post-details job selects its own account via round-robin. This allows parallel processing with multiple accounts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | BullMQ queues | via Docker | 7-alpine | -- |
| Browserless | Browser automation | via Docker | latest | -- |
| Node.js | Worker runtime | via Docker | 20-alpine | -- |
| Supabase | Account data, results storage | External service | -- | -- |
| tsx | TypeScript worker execution | npm install needed | -- | ts-node or tsc compile |

**Missing dependencies with no fallback:**
- None -- all dependencies available via Docker or npm.

**Missing dependencies with fallback:**
- `tsx` not yet installed -- add to package.json devDependencies or worker Dockerfile.

## Sources

### Primary (HIGH confidence)
- [BullMQ Workers docs](https://docs.bullmq.io/guide/workers) - Worker class API, events, autorun
- [BullMQ Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) - Exponential backoff formula, attempts config
- [BullMQ Rate Limiting](https://docs.bullmq.io/guide/rate-limiting) - Worker limiter options, queue-level rate limits
- [Browserless Connect Puppeteer](https://docs.browserless.io/baas/connect-puppeteer) - `puppeteer.connect({ browserWSEndpoint })` pattern

### Secondary (MEDIUM confidence)
- Existing codebase analysis: `lib/scraper.ts`, `lib/extraction.ts`, `lib/browser.ts`, `lib/queue.ts`, `docker-compose.yml`
- `supabase_schema.sql` - verified `last_used_at` column is missing

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in package.json
- Architecture: HIGH - decomposition pattern is straightforward, existing code is well-structured
- Pitfalls: HIGH - identified from direct codebase analysis (missing column, tsconfig paths, Browserless concurrency)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack, no fast-moving dependencies)
