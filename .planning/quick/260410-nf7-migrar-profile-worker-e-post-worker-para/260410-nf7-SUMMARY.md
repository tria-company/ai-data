---
phase: 260410-nf7
plan: 01
subsystem: workers/supabase
tags: [multi-tenant, supabase, workers, refactor]
requires:
  - 260410-mor (getSupabaseForProject)
provides:
  - getSupabaseForJob(projetoId) dispatcher
  - per-tenant DB routing inside scrapeProfile
  - per-tenant DB routing inside scrapePostDetails
affects:
  - lib/supabase.ts
  - workers/profile-worker.ts
  - workers/post-worker.ts
tech_stack:
  added: []
  patterns: [dispatcher-helper, backward-compat-null-fallback]
key_files:
  created: []
  modified:
    - lib/supabase.ts
    - workers/profile-worker.ts
    - workers/post-worker.ts
decisions:
  - Dispatcher lives in lib/supabase.ts (single source of truth for client resolution)
  - Null/empty projetoId falls back to legacy getSupabase() for backward compat with in-flight jobs
  - lib/account-selector.ts stays on the global singleton (scrapper_accounts is a shared resource per STATE.md)
metrics:
  duration: ~10 minutes
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed_date: 2026-04-10
---

# Phase 260410-nf7 Plan 01: Migrate profile-worker and post-worker to per-tenant Supabase Summary

Per-tenant DB routing wired into `scrapeProfile` and `scrapePostDetails` via a new `getSupabaseForJob(projetoId)` dispatcher in `lib/supabase.ts`, preserving legacy behavior when `projetoId` is null.

## What Changed

1. **`lib/supabase.ts`** — Added exported `getSupabaseForJob(projetoId: string | null | undefined): SupabaseClient`. Returns `getSupabaseForProject(projetoId)` when `projetoId` is a non-empty trimmed string, else `getSupabase()`. Purely additive; no existing exports were modified.

2. **`workers/profile-worker.ts`** —
   - Swapped `import { supabase }` for `import { getSupabaseForJob }`.
   - Declared `const db = getSupabaseForJob(projetoId);` as the first statement of `scrapeProfile`.
   - Replaced all 6 `supabase.from(...)` call sites inside `scrapeProfile` with `db.from(...)` (profile_bio upsert, profile_highlights upsert+select, profile_highlight_items insert, scrappers_contents upsert, users_scrapping update chain, users_scrapping insert). Chained builders (`.select('id')`, `.eq(...)`, `.upsert(..., { onConflict, ignoreDuplicates })`) preserved byte-for-byte.
   - `processProfileJob`, account-selection loop, queue enqueue calls, worker construction, event handlers, and shutdown logic untouched.

3. **`workers/post-worker.ts`** —
   - Swapped `import { supabase }` for `import { getSupabaseForJob }`.
   - Declared `const db = getSupabaseForJob(projetoId);` as the first statement of `scrapePostDetails`.
   - Replaced all 3 `supabase.from(...)` call sites inside `scrapePostDetails` with `db.from(...)` (scrappers_contents update, post_likes upsert, post_comments upsert).
   - `processPostJob`, account-selection loop, queue enqueue calls, worker construction, event handlers, and shutdown logic untouched.

## Commits

| # | SHA | Message |
|---|-----|---------|
| 1 | `e8fa814` | feat(supabase): add getSupabaseForJob dispatcher for multi-tenant workers |
| 2 | `643926a` | refactor(workers): route scrapeProfile and scrapePostDetails through getSupabaseForJob |

## Verification Results

### 1. `rg "supabase\.(from|rpc)" workers/profile-worker.ts workers/post-worker.ts`
Zero matches. All legacy call sites migrated.

### 2. `rg "getSupabaseForJob" workers/profile-worker.ts workers/post-worker.ts`
```
workers/post-worker.ts:7:import { getSupabaseForJob } from '../lib/supabase';
workers/post-worker.ts:87:  const db = getSupabaseForJob(projetoId);
workers/profile-worker.ts:7:import { getSupabaseForJob } from '../lib/supabase';
workers/profile-worker.ts:82:  const db = getSupabaseForJob(projetoId);
```
Four matches (2 per file: import + usage). Correct.

### 3. `rg "const db = getSupabaseForJob\(projetoId\)" workers/profile-worker.ts workers/post-worker.ts`
```
workers/post-worker.ts:87:  const db = getSupabaseForJob(projetoId);
workers/profile-worker.ts:82:  const db = getSupabaseForJob(projetoId);
```
Exactly 2 matches (one per file). Correct.

### 4. `npx tsc --noEmit -p .`
Zero NEW errors in `workers/*` or `lib/supabase.ts`. Pre-existing out-of-scope errors surfaced unchanged (see next section).

## Pre-existing TypeScript Errors (Tolerated, Out of Scope)

These errors existed before this task and were explicitly excluded by the plan constraints. They are documented verbatim for traceability:

```
app/api/admin/queues/[[...slug]]/route.ts(2,21): error TS7016: Could not find a declaration file for module 'express'. '/Users/igorvboas/Documents/TRIA/ai-data/node_modules/express/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`

app/api/jobs/route.ts(32,7): error TS2322: Type '{ jobId: string | undefined; status: JobState; progress: JobProgress; username: any; projetoId: any; createdAt: string; finishedAt: string | null; }[]' is not assignable to type '{ jobId: string | undefined; status: string; progress: number | object; username: string; projetoId: string | null; createdAt: string; finishedAt: string | null; }[]'.
  Type '{ jobId: string | undefined; status: JobState; progress: JobProgress; username: any; projetoId: any; createdAt: string; finishedAt: string | null; }' is not assignable to type '{ jobId: string | undefined; status: string; progress: number | object; username: string; projetoId: string | null; createdAt: string; finishedAt: string | null; }'.
    Types of property 'progress' are incompatible.
      Type 'JobProgress' is not assignable to type 'number | object'.
        Type 'string' is not assignable to type 'number | object'.

app/api/jobs/route.ts(44,7): error TS2322: Type '{ jobId: string | undefined; status: JobState | "unknown"; progress: JobProgress; username: any; projetoId: any; createdAt: string; finishedAt: string | null; }[]' is not assignable to type '{ jobId: string | undefined; status: string; progress: number | object; username: string; projetoId: string | null; createdAt: string; finishedAt: string | null; }[]'.
  Type '{ jobId: string | undefined; status: JobState | "unknown"; progress: JobProgress; username: any; projetoId: any; createdAt: string; finishedAt: string | null; }' is not assignable to type '{ jobId: string | undefined; status: string; progress: number | object; username: string; projetoId: string | null; createdAt: string; finishedAt: string | null; }'.
    Types of property 'progress' are incompatible.
      Type 'JobProgress' is not assignable to type 'number | object'.
        Type 'string' is not assignable to type 'number | object'.

server.ts(1,21): error TS7016: Could not find a declaration file for module 'express'. '/Users/igorvboas/Documents/TRIA/ai-data/node_modules/express/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`
server.ts(22,38): error TS7006: Parameter 'req' implicitly has an 'any' type.
server.ts(22,43): error TS7006: Parameter 'res' implicitly has an 'any' type.
server.ts(22,48): error TS7006: Parameter 'next' implicitly has an 'any' type.
```

None of these errors reference `workers/` or `lib/supabase.ts`, confirming this refactor introduced zero regressions.

## Scope Discipline Confirmation

- `lib/account-selector.ts` was **NOT** modified. Verified via `git diff --stat lib/account-selector.ts` → empty output. It continues to use the global `supabase` singleton for `scrapper_accounts`, consistent with the STATE.md v1.0 decision that accounts are shared resources across projects.
- `app/api/scrape/route.ts`, admin routes, scripts, and `.claude/worktrees/` were not touched.
- No new dependencies added, no formatter run.
- Pre-existing TS errors in admin queues route, jobs route, and `server.ts` were left as-is per plan constraints.

## Backward Compatibility

- Jobs already in the queue with `projetoId: null` continue to write to the legacy Supabase. `getSupabaseForJob(null)` → `getSupabase()` → same client that the previous `supabase` Proxy resolved to.
- Jobs enqueued with a known `projetoId` now route to `getSupabaseForProject(projetoId)`, which hits the per-tenant client loaded from `SUPABASE_PROJECTS`.
- Unknown `projetoId` values will throw loudly (by design — `getSupabaseForProject` enumerates known ids in the error). Worker will mark the job as failed, surfacing misconfiguration rather than silently writing to the wrong project.

## Deviations from Plan

None. Plan executed exactly as written. No auto-fixes were needed — TypeScript check surfaced only the expected pre-existing out-of-scope errors, and the refactor compiled cleanly on the first pass.

## Self-Check: PASSED

- `lib/supabase.ts` modified with `getSupabaseForJob` export (verified by grep L136).
- `workers/profile-worker.ts` modified: import swap + `const db` declaration + 6 call sites migrated (verified).
- `workers/post-worker.ts` modified: import swap + `const db` declaration + 3 call sites migrated (verified).
- Commit `e8fa814` exists in `git log` (verified).
- Commit `643926a` exists in `git log` (verified).
- `lib/account-selector.ts` untouched (verified by empty `git diff`).
- TypeScript check produces no new errors in touched files (verified).
