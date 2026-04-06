# Phase 6: API & Notifications - Research

**Researched:** 2026-04-06
**Domain:** REST API (Next.js Route Handlers) + Email Notifications (Resend) + Job Queue (BullMQ)
**Confidence:** HIGH

## Summary

Phase 6 replaces the current synchronous SSE `/api/scrape` endpoint with an asynchronous 202 Accepted pattern backed by BullMQ. Three API routes are needed: `POST /api/scrape` (enqueue job), `GET /api/jobs/[id]` (job status), and `GET /api/jobs` (filtered list). Additionally, workers must send an email via Resend when no accounts with valid cookies are available.

The existing codebase already has all the infrastructure: BullMQ queues in `lib/queue.ts`, workers in `workers/`, account selection in `lib/account-selector.ts`, and Next.js API route patterns in `app/api/`. The work is primarily wiring -- connecting the API layer to the queue and adding Resend email calls to the "no accounts" code path in both workers.

**Primary recommendation:** Use BullMQ's built-in `Queue.getJob(id)` and `Queue.getJobs(types, start, end)` methods for the job status endpoints. Use Resend SDK directly (no wrapper needed) with a single `lib/notifications.ts` utility function called from workers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `POST /api/scrape` replaces the current synchronous SSE endpoint with an async version. Same payload `{ accountId, targetUsernames, projetoId }`. Returns `202 Accepted` with `{ jobId, status: 'queued' }`. `accountId` is optional -- if omitted, worker auto-selects via round-robin.
- **D-02:** `GET /api/jobs/:id` returns full status with progress details: `{ jobId, status (queued|active|completed|failed), progress (percentage + current stage), result (when completed), error (if failed), createdAt, finishedAt }`.
- **D-03:** `GET /api/jobs` returns filtered list of jobs by `projetoId` and/or `status` query params.
- **D-04:** Email sent once per job that hits "no accounts available" and gets re-queued with 30-minute delay. The 30min delay already prevents email spam.
- **D-05:** Email sent via Resend SDK. Recipient is a fixed email from `ALERT_EMAIL` env variable in `.env`.
- **D-06:** Email content includes: which job failed, which accounts were tried and why they failed, instructions to fix (link to login page from Phase 7, or manual cookie import).
- **D-07:** Job data lives in Redis only via BullMQ. Completed jobs kept with 24h TTL (configurable). Scraped data is already persisted to Supabase by workers -- no need for separate job persistence table.
- **D-08:** Job progress reported via BullMQ `job.updateProgress()`. Progress includes percentage and current stage (e.g., "extracting bio", "processing posts 3/10").
- **D-09:** Current synchronous SSE `/api/scrape` is fully replaced by the new async 202 version. No backward compatibility layer. Frontend will poll `GET /api/jobs/:id` instead of streaming.
- **D-10:** BullMQ queues `profile-scrape` and `post-details` already defined in `lib/queue.ts`
- **D-11:** Workers already implement account selection, cookie fallback, and rate limiting (`lib/account-selector.ts`)
- **D-12:** When no accounts available, workers re-queue job with 30min delay (Phase 5 D-06) -- this is the trigger point for email notification
- **D-13:** Single `.env` shared by all containers via `env_file`

### Claude's Discretion
- Next.js API route structure (e.g., `app/api/jobs/[id]/route.ts`)
- How to integrate Resend SDK (direct call vs utility wrapper)
- BullMQ job TTL configuration values
- Error response format and HTTP status codes for edge cases
- Whether to add Resend to existing worker code or create a notification utility

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | POST /api/scrape aceita request e retorna 202 Accepted com jobId | BullMQ `profileScrapeQueue.add()` returns Job with `.id`; replace current SSE route |
| API-02 | GET /api/jobs/:id retorna status, progresso e resultado do job | BullMQ `Queue.getJob(id)` returns Job with `.progress`, `.returnvalue`, `.failedReason`, `.finishedOn`, `.timestamp` |
| API-03 | GET /api/jobs lista jobs com filtro por projetoId e status | BullMQ `Queue.getJobs(types)` with client-side filtering by `job.data.projetoId` |
| ACCT-03 | Se nenhuma conta disponivel, envia email via Resend com alerta e instrucoes | Resend SDK `resend.emails.send()` called from notification utility in worker "no accounts" path |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | 5.73.0 | Job queue, job state queries | Already in use (Phase 5), provides getJob/getJobs API |
| resend | 4.1.2 | Email notifications | Decided in D-05, simple SDK, free tier 3K/month |
| next | 16.1.4 | API route handlers | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ioredis | 5.10.1 | Redis connection (BullMQ dependency) | Already installed |

**Note on Resend version:** npm registry shows 6.10.0 as latest. However, verify the actual installed version after `npm install resend`. The SDK API (`resend.emails.send()`) is stable across versions.

**Installation:**
```bash
npm install resend
```

No other new dependencies needed -- BullMQ, ioredis, and Next.js are already installed.

## Architecture Patterns

### Recommended Route Structure
```
app/api/
├── scrape/
│   └── route.ts          # POST - REPLACE existing SSE with 202 async
├── jobs/
│   ├── route.ts          # GET - list jobs with filters
│   └── [id]/
│       └── route.ts      # GET - single job status
lib/
├── queue.ts              # EXISTING - add defaultJobOptions for TTL
├── notifications.ts      # NEW - Resend email utility
workers/
├── profile-worker.ts     # MODIFY - add email on no-accounts
├── post-worker.ts        # MODIFY - add email on no-accounts
```

### Pattern 1: Async Job Submission (POST /api/scrape)
**What:** API accepts scrape request, enqueues to BullMQ, returns 202 immediately.
**When to use:** Replacing the current synchronous SSE endpoint.
**Example:**
```typescript
// app/api/scrape/route.ts
import { NextResponse } from 'next/server';
import { profileScrapeQueue } from '@/lib/queue';

export async function POST(request: Request) {
  const { accountId, targetUsernames, projetoId } = await request.json();

  if (!targetUsernames || !Array.isArray(targetUsernames) || targetUsernames.length === 0) {
    return NextResponse.json({ error: 'targetUsernames is required' }, { status: 400 });
  }

  // Enqueue one job per target username
  const jobs = await Promise.all(
    targetUsernames.map((username: string) =>
      profileScrapeQueue.add('profile-scrape', {
        username,
        projetoId: projetoId || null,
        accountId: accountId || null, // optional, worker auto-selects if null
      })
    )
  );

  return NextResponse.json(
    {
      jobIds: jobs.map(j => j.id),
      status: 'queued',
      count: jobs.length,
    },
    { status: 202 }
  );
}
```

### Pattern 2: Job Status Query (GET /api/jobs/[id])
**What:** Query BullMQ for a specific job's state, progress, and result.
**Example:**
```typescript
// app/api/jobs/[id]/route.ts
import { NextResponse } from 'next/server';
import { profileScrapeQueue } from '@/lib/queue';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Next.js 15+ async params
  const job = await profileScrapeQueue.getJob(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const state = await job.getState();

  return NextResponse.json({
    jobId: job.id,
    status: state, // queued | active | completed | failed | delayed
    progress: job.progress,
    result: job.returnvalue,
    error: job.failedReason || null,
    createdAt: new Date(job.timestamp).toISOString(),
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    data: job.data, // includes username, projetoId
  });
}
```

### Pattern 3: Job List with Filters (GET /api/jobs)
**What:** List jobs from BullMQ with optional projetoId and status filters.
**Example:**
```typescript
// app/api/jobs/route.ts
import { NextResponse } from 'next/server';
import { profileScrapeQueue } from '@/lib/queue';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projetoId = searchParams.get('projetoId');
  const status = searchParams.get('status');

  // Map status to BullMQ job types
  const types = status
    ? [status as any]
    : ['waiting', 'active', 'completed', 'failed', 'delayed'];

  const jobs = await profileScrapeQueue.getJobs(types, 0, 99);

  let results = await Promise.all(
    jobs.map(async (job) => ({
      jobId: job.id,
      status: await job.getState(),
      progress: job.progress,
      username: job.data.username,
      projetoId: job.data.projetoId,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    }))
  );

  // Client-side filter by projetoId (BullMQ has no built-in data filter)
  if (projetoId) {
    results = results.filter(j => j.projetoId === projetoId);
  }

  return NextResponse.json(results);
}
```

### Pattern 4: Email Notification Utility
**What:** Centralized Resend call for "no accounts available" alerts.
**Example:**
```typescript
// lib/notifications.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNoAccountsAlert(jobInfo: {
  jobId: string;
  username: string;
  triedAccounts: string[];
  reason: string;
}) {
  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail || !process.env.RESEND_API_KEY) {
    console.warn('[notifications] ALERT_EMAIL or RESEND_API_KEY not set, skipping email');
    return;
  }

  try {
    await resend.emails.send({
      from: 'Scraper Alert <alerts@yourdomain.com>', // Must be verified domain in Resend
      to: [alertEmail],
      subject: `[Scraper] No accounts available - @${jobInfo.username}`,
      html: `
        <h2>No Instagram Accounts Available</h2>
        <p>Job <strong>${jobInfo.jobId}</strong> for <strong>@${jobInfo.username}</strong> could not find a valid account.</p>
        <p><strong>Accounts tried:</strong> ${jobInfo.triedAccounts.join(', ') || 'None available'}</p>
        <p><strong>Reason:</strong> ${jobInfo.reason}</p>
        <p>The job has been re-queued with a 30-minute delay.</p>
        <h3>To fix:</h3>
        <ul>
          <li>Go to <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/login-session">Login Session</a> and re-authenticate an account</li>
          <li>Or manually import valid cookies for an account</li>
        </ul>
      `,
    });
    console.log(`[notifications] Alert email sent for job ${jobInfo.jobId}`);
  } catch (error) {
    console.error('[notifications] Failed to send alert email:', error);
  }
}
```

### Anti-Patterns to Avoid
- **Polling without limits:** `GET /api/jobs` returning ALL jobs ever -- use BullMQ's `start/end` pagination and completed job TTL
- **Storing jobs in Supabase:** Per D-07, jobs live in Redis only; scraped data is already persisted by workers
- **Sending email on every retry:** Per D-04, email is sent ONCE when the "no accounts" path is hit; the 30min re-queue delay prevents spam naturally
- **Creating new Queue instances per request:** Import the singleton from `lib/queue.ts`, do not instantiate new Queue objects in API routes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job state management | Custom Redis keys for tracking | BullMQ `getJob()`, `getState()`, `job.progress` | BullMQ already tracks all states atomically |
| Job listing/filtering | Custom Supabase table for jobs | BullMQ `getJobs(types)` | Avoids dual storage, Redis is the source of truth |
| Email delivery | `fetch()` to Resend HTTP API | `resend` npm SDK | Type safety, error handling, retries built in |
| Job progress tracking | Custom progress events/SSE | BullMQ `job.updateProgress()` | Already used in workers (lines 138, 162, 220 in profile-worker) |

**Key insight:** BullMQ is already the job state machine. The API routes are thin read layers over BullMQ's existing data -- no new persistence layer needed.

## Common Pitfalls

### Pitfall 1: Forgetting async params in Next.js 15+
**What goes wrong:** `params` is now a Promise in Next.js 15+ route handlers. Using `params.id` directly causes a runtime error.
**Why it happens:** Next.js 15 changed params to be async.
**How to avoid:** Always `const { id } = await params;` in route handlers.
**Warning signs:** Type error or undefined params at runtime.

### Pitfall 2: BullMQ Queue instance in Next.js API routes
**What goes wrong:** Creating a new `Queue` instance per request leads to connection leaks.
**Why it happens:** Next.js API routes are serverless-style -- each invocation may re-execute module-level code.
**How to avoid:** Import the singleton queue from `lib/queue.ts`. The existing pattern with module-level `new Queue()` works because Next.js caches module imports within the same process.
**Warning signs:** Redis connection count growing, "too many connections" errors.

### Pitfall 3: Resend "from" address must be verified domain
**What goes wrong:** Emails fail with 403 if `from` address uses an unverified domain.
**Why it happens:** Resend requires domain verification for custom `from` addresses.
**How to avoid:** Either verify your domain in Resend dashboard, or use `onboarding@resend.dev` for testing.
**Warning signs:** 403 Forbidden from Resend API.

### Pitfall 4: getJobs returns limited data without state
**What goes wrong:** `job.getState()` requires an additional Redis call per job. Calling it for 100+ jobs in a list endpoint is slow.
**Why it happens:** BullMQ stores jobs in separate Redis lists per state -- `getJobs(types)` already knows the state from the type parameter.
**How to avoid:** When listing by type, you already know the state from the `types` param you passed. Only call `job.getState()` for single-job queries or when mixing types.
**Warning signs:** Slow `/api/jobs` responses.

### Pitfall 5: Worker email notification must track "already sent"
**What goes wrong:** If a re-queued job hits "no accounts" again after 30min, it sends another email.
**Why it happens:** The re-queued job is a NEW job (via `queue.add()`), so it goes through the same code path.
**How to avoid:** Per D-04, the 30min delay already prevents spam. But consider adding a Redis key like `email:no-accounts:{timestamp-bucket}` with a 1-hour TTL to deduplicate within a window if needed.
**Warning signs:** Multiple alert emails for the same underlying problem.

### Pitfall 6: Job TTL configuration
**What goes wrong:** Completed jobs pile up in Redis, consuming memory.
**Why it happens:** BullMQ keeps completed jobs indefinitely by default.
**How to avoid:** Set `defaultJobOptions.removeOnComplete` on the queue. Use `{ count: 100, age: 86400 }` (keep last 100 or 24h, whichever comes first).
**Warning signs:** Redis memory growing, slow `getJobs()` calls.

## Code Examples

### Configuring Job TTL on Queue (D-07)
```typescript
// lib/queue.ts - Updated with TTL
import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? Number(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
};

const defaultJobOptions = {
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours in seconds
    count: 200,         // keep at most 200 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days for failed jobs (debugging)
    count: 500,
  },
};

export const profileScrapeQueue = new Queue('profile-scrape', {
  connection,
  defaultJobOptions,
});
export const postDetailsQueue = new Queue('post-details', {
  connection,
  defaultJobOptions,
});

export { connection };
```

### Worker Integration Point for Email (D-12)
```typescript
// In workers/profile-worker.ts, replace the "no accounts" block:

// No accounts available -- re-queue with 30-minute delay AND send email
import { sendNoAccountsAlert } from '../lib/notifications';

// ... inside processProfileJob, after the while loop:
await sendNoAccountsAlert({
  jobId: job.id!,
  username: job.data.username,
  triedAccounts: [], // Could track tried accounts in the loop
  reason: 'All accounts have invalid cookies or are rate-limited',
});

await profileScrapeQueue.add('profile-scrape', job.data, {
  delay: 30 * 60 * 1000,
});
```

### Updated Progress Reporting (D-08)
```typescript
// Workers already call job.updateProgress(20), etc.
// Enhance to include stage description:
await job.updateProgress({ percent: 20, stage: 'extracting bio' });
await job.updateProgress({ percent: 40, stage: 'extracting highlights' });
await job.updateProgress({ percent: 80, stage: `processing posts` });
await job.updateProgress({ percent: 100, stage: 'complete' });
```

### Environment Variables Needed
```bash
# Add to .env
RESEND_API_KEY=re_xxxxxxxxxxxx
ALERT_EMAIL=admin@yourdomain.com
APP_URL=http://localhost:3000  # For email links
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE streaming for scrape progress | Async 202 + polling | This phase | Decouples API from scraping, enables external consumers |
| Synchronous scrape in API route | BullMQ job queue | Phase 5 | Workers handle scraping, API just enqueues |
| No failure notifications | Resend email alerts | This phase | Human gets notified when cookies expire |

**Deprecated/outdated:**
- SSE `/api/scrape` endpoint: Being fully replaced (D-09), no backward compatibility

## Open Questions

1. **Resend "from" domain**
   - What we know: Resend requires verified sender domain for production
   - What's unclear: Whether the user has already set up a domain in Resend or will use `onboarding@resend.dev` for testing
   - Recommendation: Code should work with `onboarding@resend.dev` as default, configurable via `RESEND_FROM_EMAIL` env var

2. **Multi-queue job listing**
   - What we know: `GET /api/jobs` per D-03 should list jobs, but we have TWO queues (profile-scrape + post-details)
   - What's unclear: Whether the user wants to list jobs from both queues or just profile-scrape
   - Recommendation: List only `profile-scrape` jobs (these are the user-initiated scrape requests). Post-details are internal sub-jobs. If needed, add `?queue=post-details` param later.

3. **Tracking tried accounts for email content**
   - What we know: D-06 says email should include "which accounts were tried and why they failed"
   - What's unclear: The current `selectAccount()` doesn't return a list of tried accounts
   - Recommendation: Add a wrapper or modify the worker loop to collect tried account names before hitting "no accounts". Pass this list to `sendNoAccountsAlert()`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | BullMQ queues | Yes (Docker) | 7-alpine | -- |
| BullMQ | Job management | Yes | 5.73.0 (installed) | -- |
| Resend | Email notifications | No (not installed) | -- | Install via `npm install resend` |
| Next.js | API routes | Yes | 16.1.4 | -- |

**Missing dependencies with no fallback:**
- None (Resend just needs `npm install`)

**Missing dependencies with fallback:**
- None

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Maintain Next.js + Supabase existing stack, add BullMQ + Redis + Browserless
- **Deploy**: Docker Compose on VPS
- **Backward compatibility**: `projeto` field is nullable, data without project must remain accessible
- **GSD Workflow**: Use GSD commands for file changes

## Sources

### Primary (HIGH confidence)
- BullMQ API docs (v5) - Queue.getJob(), Queue.getJobs(), Job properties: https://api.docs.bullmq.io/classes/v5.QueueGetters.html
- BullMQ Getters guide: https://docs.bullmq.io/guide/jobs/getters
- BullMQ Job class API: https://api.docs.bullmq.io/classes/v5.Job.html
- Resend Node.js SDK: https://resend.com/docs/send-with-nodejs

### Secondary (MEDIUM confidence)
- Existing codebase patterns (lib/queue.ts, workers/*, app/api/*)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ and Resend are already decided; versions verified against npm registry
- Architecture: HIGH - Patterns derived directly from existing codebase and BullMQ API docs
- Pitfalls: HIGH - Based on known Next.js 15+ async params change and verified BullMQ behavior

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable libraries, unlikely to change)
