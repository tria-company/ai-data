---
phase: 260410-mor-refatorar-lib-supabase-ts-para-suportar-
plan: 01
subsystem: supabase-client
tags: [supabase, multi-tenant, refactor, backward-compatible]
requirements: [QUICK-260410-MOR-01]
dependency_graph:
  requires:
    - "@supabase/supabase-js (already installed, ^2.91.0)"
    - "SUPABASE_PROJECTS env var (populated out-of-band)"
  provides:
    - "getSupabaseForProject(projetoId): memoized service-role SupabaseClient"
    - "getSupabaseAnonKeyForProject(projetoId): { url, anonKey }"
    - "ProjectSupabaseConfig type"
  affects:
    - "lib/supabase.ts (extended; legacy exports preserved)"
    - ".env (gitignored; SUPABASE_PROJECTS added, legacy vars annotated)"
tech-stack:
  added: []
  patterns:
    - "Module-scoped memoization (Map<projetoId, SupabaseClient>)"
    - "Lazy JSON parse with cached ProjectMap"
    - "Prefixed error messages ([supabase] ...) for debuggable failures"
key-files:
  created: []
  modified:
    - lib/supabase.ts
    - .env
decisions:
  - "Keep legacy getSupabase() / supabase Proxy exports byte-identical to avoid breaking 36 existing call sites"
  - "Service-role client created with auth: { persistSession: false, autoRefreshToken: false } (worker-appropriate)"
  - "SUPABASE_PROJECTS left empty in .env; populated out-of-band when multi-tenant code paths ship"
  - ".env is gitignored, so Task 2 changes are on-disk only (no git commit possible for that file)"
metrics:
  duration_minutes: ~3
  completed: 2026-04-10
---

# Phase 260410-mor Plan 01: Refactor lib/supabase.ts for Multi-Tenant Support Summary

One-liner: Extended `lib/supabase.ts` with a multi-tenant `getSupabaseForProject(projetoId)` API backed by a `SUPABASE_PROJECTS` JSON env var, while preserving the legacy `getSupabase()` / `supabase` Proxy exports untouched so all 36 existing call sites keep working.

## What Changed

### `lib/supabase.ts` (modified)

Preserved verbatim:
- `getSupabase(): SupabaseClient` — same body, same env var precedence (`SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`), same error message
- `supabase` Proxy wrapper — unchanged

Added:
- `ProjectSupabaseConfig` type (`{ url, anonKey, serviceKey }`)
- `getSupabaseForProject(projetoId: string): SupabaseClient` — memoized service-role client per projetoId
- `getSupabaseAnonKeyForProject(projetoId: string): { url, anonKey }` — safe-to-expose public pair
- Internal `loadProjectMap()` + `getProjectConfig()` helpers with strict validation and `[supabase]`-prefixed errors
- Module-scoped caches: `_projectMap: ProjectMap | null` and `_projectClientCache: Map<string, SupabaseClient>`

### `.env` (modified, gitignored)

- Added annotated comment block marking legacy Supabase vars as backward-compatibility fallback
- Added `SUPABASE_PROJECTS=` (empty value) with documented JSON shape example comments
- All 11 pre-existing env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, REDIS_URL, BROWSERLESS_WS_ENDPOINT, RESEND_API_KEY, ALERT_EMAIL, RESEND_FROM_EMAIL, BULLBOARD_USER, BULLBOARD_PASS) preserved byte-for-byte
- Commented proxy block at bottom preserved verbatim

## How to Use the New API

Server-only — service-role client (workers, API routes):

```typescript
import { getSupabaseForProject } from '@/lib/supabase';

async function loadTargets(projetoId: string) {
  const db = getSupabaseForProject(projetoId);
  const { data, error } = await db.from('targets').select('*').eq('projeto_id', projetoId);
  if (error) throw error;
  return data;
}
```

Safe-to-expose public config (passing url/anonKey to frontend code):

```typescript
import { getSupabaseAnonKeyForProject } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: Promise<{ projetoId: string }> }) {
  const { projetoId } = await params;
  const { url, anonKey } = getSupabaseAnonKeyForProject(projetoId);
  return Response.json({ url, anonKey });
}
```

## Error Semantics

All new-API errors are prefixed with `[supabase]` and name the offending env var or projetoId:

- Unset env: `[supabase] SUPABASE_PROJECTS env var is not set. Expected a JSON string: {...}`
- Invalid JSON: `[supabase] SUPABASE_PROJECTS is not valid JSON: <reason>. Expected shape: {...}`
- Wrong shape: `[supabase] SUPABASE_PROJECTS must be a JSON object mapping projetoId -> { url, anonKey, serviceKey }`
- Missing fields: `[supabase] SUPABASE_PROJECTS entry "<id>" is missing required fields. Each entry must have { url, anonKey, serviceKey }.`
- Unknown projetoId: `[supabase] Unknown projetoId "<id>". Known ids in SUPABASE_PROJECTS: <list>`

## Migration Note

36 call sites still use the legacy `getSupabase()` / `supabase` Proxy. A follow-up phase will migrate them to `getSupabaseForProject(projetoId)` where appropriate. Until then, both APIs coexist safely — the legacy path reads `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, while the multi-tenant path reads `SUPABASE_PROJECTS`.

**Reminder:** populate `SUPABASE_PROJECTS` in `.env` before any code path calls `getSupabaseForProject()` or `getSupabaseAnonKeyForProject()`. The JSON shape is documented in the `.env` comments. Calling the new API while `SUPABASE_PROJECTS` is empty will throw a clear actionable error.

## Deviations from Plan

**None (auto-fixed scope).** Plan executed exactly as written.

### Notes on Task 2 commit

`.env` is listed in `.gitignore` (line 34: `.env* .env`), so the Task 2 modifications are on-disk only and cannot be committed to the repository. This is correct and expected behavior for secret hygiene — no deviation, no rule applied. The file was updated using the exact byte-for-byte preserved values pulled from the on-disk `.env` read at the start of the session.

## Deferred Issues

Pre-existing TypeScript errors unrelated to this plan (out of scope per deviation-rules scope boundary) — not introduced by this refactor, observed during the overall `tsc --noEmit` sanity check:

- `app/api/admin/queues/[[...slug]]/route.ts`: missing `@types/express` declaration
- `app/api/jobs/route.ts`: `JobProgress` type assignability to `number | object` (pre-existing)
- `server.ts`: missing `@types/express` declaration, implicit-any parameters

These are logged here for traceability but MUST NOT be addressed in this quick task.

## Commits

- `b52bbc3` — feat(260410-mor-01): add multi-tenant Supabase API (Task 1, lib/supabase.ts)
- Task 2 (`.env`): no commit — file is gitignored; changes are on-disk only

## Self-Check

- [x] `lib/supabase.ts` modified and compiles clean (no errors originating in this file per `tsc --noEmit`)
- [x] Legacy exports `getSupabase`, `supabase` preserved verbatim
- [x] New exports `getSupabaseForProject`, `getSupabaseAnonKeyForProject`, `ProjectSupabaseConfig` present
- [x] Service-role client created with `persistSession: false, autoRefreshToken: false`
- [x] `.env` on disk contains `SUPABASE_PROJECTS=` line and all 11 legacy vars intact
- [x] No secrets exposed in this SUMMARY or in commit messages
- [x] Commit `b52bbc3` exists in git history
