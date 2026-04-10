---
phase: quick-260410-qu3
plan: 01
subsystem: api-workers-db-routing
tags: [quick, api, workers, supabase, multi-tenant, backward-compat]
requires:
  - quick-260410-mor (SUPABASE_PROJECTS multi-tenant client helper)
  - quick-260410-nf7 (getSupabaseForJob dispatcher in workers)
provides:
  - "POST /api/scrape accepts optional db_account field in request body"
  - "getSupabaseForJob(dbAccount, projetoIdFallback?) with dbAccount-first routing"
  - "ProfileJobData and PostJobData carry optional dbAccount through BullMQ"
affects:
  - lib/supabase.ts
  - app/api/scrape/route.ts
  - workers/profile-worker.ts
  - workers/post-worker.ts
tech_stack_added: []
patterns:
  - "HTTP boundary converts snake_case db_account -> camelCase dbAccount"
  - "Credential router decoupled from projeto column tag"
  - "Backward-compat via two-arg fallback: dbAccount -> projetoIdFallback -> legacy getSupabase()"
key_files_created: []
key_files_modified:
  - lib/supabase.ts
  - app/api/scrape/route.ts
  - workers/profile-worker.ts
  - workers/post-worker.ts
decisions:
  - "Keep getSupabaseForJob as single entry point rather than adding a parallel getSupabaseForDbAccount — reduces API surface and call-site churn"
  - "dbAccount parameter comes FIRST in the new signature so its primary role is obvious at every call site"
  - "projetoIdFallback is optional with default undefined to keep legacy one-arg callers (if any) type-valid during transition"
  - "Normalize dbAccount to null (not undefined) in enqueue payloads for stable JSON shape across BullMQ serialization"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 3
  files_changed: 4
  commits: 3
---

# Quick Task 260410-qu3: Decouple DB Routing from projetoId via db_account

Split the dual role of `projetoId` so API clients can route writes into one tenant's Supabase while still tagging rows with a different project identifier. Introduces an optional `db_account` field at the HTTP boundary that flows as `dbAccount` through BullMQ job payloads and is consumed EXCLUSIVELY for credential routing inside `getSupabaseForJob`.

## One-liner

POST /api/scrape now accepts `db_account` which workers use to pick the Supabase credential, with full fallback to the existing `projetoId`-based routing so legacy callers and in-flight queue jobs keep working identically.

## Files Changed

| File | Change |
| --- | --- |
| `lib/supabase.ts` | `getSupabaseForJob` now takes `(dbAccount, projetoIdFallback?)` with a documented 3-step resolution order. |
| `app/api/scrape/route.ts` | Destructures `db_account` from the request body and forwards it as `dbAccount: db_account \|\| null` in every profile-scrape job payload. |
| `workers/profile-worker.ts` | `ProfileJobData` gains optional `dbAccount`. `scrapeProfile` receives and uses it via `getSupabaseForJob(dbAccount, projetoId)`. Post-details child jobs forward `dbAccount: dbAccount ?? null`. |
| `workers/post-worker.ts` | `PostJobData` gains optional `dbAccount`. `scrapePostDetails` receives and uses it via `getSupabaseForJob(dbAccount, projetoId)`. |

## New `getSupabaseForJob` Signature

```typescript
export function getSupabaseForJob(
  dbAccount: string | null | undefined,
  projetoIdFallback?: string | null,
): SupabaseClient
```

Resolution order (exact priority):

1. `dbAccount` non-empty (after trim) → `getSupabaseForProject(dbAccount)`.
2. Else `projetoIdFallback` non-empty (after trim) → `getSupabaseForProject(projetoIdFallback)`.
3. Else legacy `getSupabase()` client (unchanged last-resort fallback).

Neither argument is ever written to a DB column. This function ONLY selects which `SupabaseClient` to return. The `projeto` column in downstream writes remains driven by the caller's own `projetoId` value.

## Backward-Compatibility Contract

### Legacy API callers

A request body like `{ targetUsernames: [...], projetoId: "abc" }` with no `db_account` field:

- Destructures `db_account` as `undefined`.
- Enqueues payload `{ username, projetoId: "abc", dbAccount: null, accountId: ..., maxPosts? }`.
- Worker destructures `dbAccount` as `null`.
- `getSupabaseForJob(null, "abc")` falls through step 1, hits step 2, returns `getSupabaseForProject("abc")`.
- Result: **identical to pre-change behavior.** Same client, same tables, same writes.

A legacy request without `projetoId` either behaves the same as today (legacy `getSupabase()` client) because both args are null/undefined.

### In-flight BullMQ jobs (enqueued before this deploy)

Jobs already sitting in Redis were serialized before the new field existed:

- Their `job.data` has no `dbAccount` key.
- Worker destructuring yields `dbAccount = undefined`.
- `getSupabaseForJob(undefined, projetoId)` skips step 1, hits step 2 when `projetoId` is non-empty, else step 3.
- Result: **identical routing to pre-change behavior.** No job is lost, no client mismatch, no failure mode introduced.

The rate-limit re-enqueue paths (`profileScrapeQueue.add('profile-scrape', job.data, { delay })` and the equivalent in post-worker) forward `job.data` as-is, so `dbAccount` rides along unchanged on newly-enqueued jobs and is simply absent on re-enqueued legacy jobs — both cases handled by the fallback.

## Name Convention at the Boundary

| Layer | Field name | Type |
| --- | --- | --- |
| HTTP request body | `db_account` | snake_case (convention for the existing API shape) |
| BullMQ job payload | `dbAccount` | camelCase |
| TypeScript interfaces / vars | `dbAccount` | camelCase |

Conversion happens in exactly one place: `app/api/scrape/route.ts` line `dbAccount: db_account || null`.

## Intentionally-Untouched Call Sites

- `getSupabaseForProject` and `getSupabaseAnonKeyForProject` — unchanged public API used elsewhere in the codebase.
- `_projectClientCache` memoization — unchanged.
- Every `...(projetoId ? { projeto: projetoId } : {})` spread in both workers — preserved byte-identically. Baseline counts retained: 5 spreads in `profile-worker.ts`, 2 in `post-worker.ts`.
- Account selection loop, rate-limit handling, no-accounts-alert logic, rate-limited re-enqueue — all untouched. Their contracts did not change.
- Response body of POST /api/scrape — still `{ jobIds, status: 'queued', count }` with `202`. No new fields leaked to clients.

## Verification Performed

1. **Type check on touched files:** `npx tsc --noEmit` produces zero errors in `lib/supabase.ts`, `app/api/scrape/route.ts`, `workers/profile-worker.ts`, or `workers/post-worker.ts`. Pre-existing errors in `app/api/admin/queues/[[...slug]]/route.ts`, `app/api/jobs/route.ts`, and `server.ts` are out of scope (missing `@types/express`, pre-existing `JobProgress` type issue) and were NOT introduced by this task.
2. **Grep sanity — getSupabaseForJob call sites:**
   ```
   workers/post-worker.ts:89:  const db = getSupabaseForJob(dbAccount, projetoId);
   workers/profile-worker.ts:84:  const db = getSupabaseForJob(dbAccount, projetoId);
   lib/supabase.ts:146: export function getSupabaseForJob(
   ```
3. **Grep sanity — projeto column spreads preserved:**
   - `workers/profile-worker.ts`: 5 matches (baseline: 5) — byte-identical.
   - `workers/post-worker.ts`: 2 matches (baseline: 2) — byte-identical.
4. **Grep sanity — no DB column writes for dbAccount:** All `dbAccount` literals in worker files are: interface field, destructuring, function parameter, function body (getSupabaseForJob call), and the single post-details enqueue payload forward. Zero `.upsert`/`.insert`/`.update` payloads contain a `dbAccount` key.
5. **HTTP boundary grep:**
   ```
   app/api/scrape/route.ts:7:    const { accountId, targetUsernames, projetoId, db_account, maxPosts } = body;
   app/api/scrape/route.ts:22:        dbAccount: db_account || null,
   ```

## Deviations from Plan

None of substance. One minor note: the plan's expected-count comment for `projeto: projetoId` spreads in `profile-worker.ts` mentioned "6", but the actual baseline count is 5. The plan's verification step said "verify by comparing to git", which is exactly what was done — the count is unchanged at 5. No code changes were needed to reach the intended byte-identical preservation.

## Task Commits

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Extend getSupabaseForJob with dbAccount-first routing | `f21b451` | `lib/supabase.ts` |
| 2 | Thread db_account through POST /api/scrape | `2a64796` | `app/api/scrape/route.ts` |
| 3 | Route workers through dbAccount with projetoId fallback | `6cda3ee` | `workers/profile-worker.ts`, `workers/post-worker.ts` |

## Self-Check: PASSED

- Files modified exist:
  - FOUND: `lib/supabase.ts`
  - FOUND: `app/api/scrape/route.ts`
  - FOUND: `workers/profile-worker.ts`
  - FOUND: `workers/post-worker.ts`
- Commits exist on branch:
  - FOUND: `f21b451`
  - FOUND: `2a64796`
  - FOUND: `6cda3ee`
- Type check on touched files: clean.
- `projeto: projetoId` spread count preserved (5 + 2).
- No DB writes introduced for `dbAccount`.
