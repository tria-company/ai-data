---
phase: 260410-mor-refatorar-lib-supabase-ts-para-suportar-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/supabase.ts
  - .env
autonomous: true
requirements:
  - QUICK-260410-MOR-01
must_haves:
  truths:
    - "Existing imports from '@/lib/supabase' continue to work unchanged (getSupabase + supabase Proxy export)"
    - "A new function getSupabaseForProject(projetoId) returns a SupabaseClient bound to the project's URL + serviceKey"
    - "A new function getSupabaseAnonKeyForProject(projetoId) returns { url, anonKey } for a given project"
    - "SUPABASE_PROJECTS JSON is parsed once and cached in-process; SupabaseClient instances are memoized per projetoId"
    - "Missing or malformed SUPABASE_PROJECTS produces a clear, actionable error (not a cryptic JSON.parse stack)"
    - "Unknown projetoId produces a clear error naming the missing id"
    - "Legacy env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) remain in .env for backward compatibility"
    - "SUPABASE_PROJECTS env var is present in .env with a documented JSON shape example"
  artifacts:
    - path: "lib/supabase.ts"
      provides: "Legacy getSupabase + supabase Proxy + new getSupabaseForProject + getSupabaseAnonKeyForProject + ProjectSupabaseConfig type"
      exports: ["getSupabase", "supabase", "getSupabaseForProject", "getSupabaseAnonKeyForProject", "ProjectSupabaseConfig"]
      contains: "createClient"
    - path: ".env"
      provides: "Legacy Supabase vars (unchanged values) + new SUPABASE_PROJECTS with documented example"
      contains: "SUPABASE_PROJECTS"
  key_links:
    - from: "lib/supabase.ts::getSupabaseForProject"
      to: "process.env.SUPABASE_PROJECTS"
      via: "JSON.parse on first call, cached in module-scoped Map"
      pattern: "JSON\\.parse.*SUPABASE_PROJECTS"
    - from: "lib/supabase.ts::getSupabaseForProject"
      to: "@supabase/supabase-js::createClient"
      via: "createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })"
      pattern: "createClient\\("
    - from: "lib/supabase.ts::supabase (Proxy)"
      to: "getSupabase()"
      via: "Proxy get trap (unchanged from current impl)"
      pattern: "new Proxy"
---

<objective>
Refactor `lib/supabase.ts` to support multi-tenant Supabase via the `SUPABASE_PROJECTS` env var (Opção A — static map), while keeping every existing import working unchanged.

Purpose: Unlock per-projeto Supabase isolation (each projeto can point at its own Supabase instance) without breaking the 36 existing call sites that currently import `getSupabase` / `supabase`. This is a foundation for a later migration phase — call sites will be refactored incrementally afterwards.

Output:
- Extended `lib/supabase.ts` with new API surface (`getSupabaseForProject`, `getSupabaseAnonKeyForProject`, `ProjectSupabaseConfig` type) alongside preserved legacy exports
- `.env` updated with `SUPABASE_PROJECTS` placeholder JSON (legacy vars preserved verbatim, annotated as legacy/fallback)
</objective>

<execution_context>
@/Users/igorvboas/Documents/TRIA/social-media-scrapper/.claude/get-shit-done/workflows/execute-plan.md
@/Users/igorvboas/Documents/TRIA/social-media-scrapper/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@lib/supabase.ts
@package.json
@.env

<interfaces>
<!-- Current contracts the executor must preserve and extend. Extracted directly from the codebase. -->
<!-- The executor should NOT explore other files — everything needed is here. -->

Current `lib/supabase.ts` (ENTIRE FILE — must be preserved as baseline):

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});
```

Package already installed: `@supabase/supabase-js@^2.91.0` (see package.json line 15). No new deps.

Existing call sites that import from `@/lib/supabase` (DO NOT MODIFY in this plan — 36 files use `getSupabase()` or the `supabase` Proxy; migration happens in a later phase):
- workers/profile-worker.ts
- workers/post-worker.ts
- app/api/accounts/list/route.ts
- app/api/accounts/import-cookies/route.ts
- app/api/accounts/validate-session/route.ts
- app/api/accounts/save-session/route.ts
- app/api/targets/create/route.ts
- app/api/targets/list/route.ts
- app/api/targets/update-status/route.ts
- app/api/projetos/create/route.ts
- app/api/projetos/list/route.ts
- (+ 25 others — all ignored in this refactor)

New API surface to add (types & function signatures — executor implements against these):

```typescript
// New exported type
export type ProjectSupabaseConfig = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

// Server-only. Returns a memoized service-role client for the given projetoId.
// Throws if SUPABASE_PROJECTS is unset/malformed or if projetoId is not found.
export function getSupabaseForProject(projetoId: string): SupabaseClient;

// Returns the public (url, anonKey) pair for the given projetoId.
// Safe to pass to frontend code. Throws with the same error semantics as above.
export function getSupabaseAnonKeyForProject(projetoId: string): {
  url: string;
  anonKey: string;
};
```

Current `.env` shape (values preserved verbatim in task action — see file on disk):
- `NEXT_PUBLIC_SUPABASE_URL` (legacy, keep)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy, keep)
- `SUPABASE_SERVICE_ROLE_KEY` (legacy, keep)
- `ENCRYPTION_KEY`, `REDIS_URL`, `BROWSERLESS_WS_ENDPOINT`, `RESEND_API_KEY`, `ALERT_EMAIL`, `RESEND_FROM_EMAIL`, `BULLBOARD_USER`, `BULLBOARD_PASS` (all unrelated, preserve verbatim)
- Commented proxy vars at bottom (preserve verbatim)

No `.env.example` file exists in the repo root (confirmed by directory listing) — that step from task_details is a no-op and should be skipped.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend lib/supabase.ts with multi-tenant API (preserve legacy exports)</name>
  <files>lib/supabase.ts</files>
  <action>
Rewrite `lib/supabase.ts` to add the multi-tenant API while preserving the legacy exports BIT-FOR-BIT.

Structure the file as follows:

1. Import `createClient` and `SupabaseClient` from `@supabase/supabase-js` (unchanged).

2. Keep the existing legacy section EXACTLY AS-IS:
   - Module-scoped `_supabase: SupabaseClient | null = null`
   - `export function getSupabase()` — same body, same error message, same env var precedence (`SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `export const supabase = new Proxy(...)` — same implementation
   - These exports MUST NOT change behavior; 36 call sites depend on them.

3. Add the new multi-tenant section BELOW the legacy section:

   ```typescript
   // ---------------------------------------------------------------------------
   // Multi-tenant API (SUPABASE_PROJECTS)
   // ---------------------------------------------------------------------------

   export type ProjectSupabaseConfig = {
     url: string;
     anonKey: string;
     serviceKey: string;
   };

   type ProjectMap = Record<string, ProjectSupabaseConfig>;

   let _projectMap: ProjectMap | null = null;
   const _projectClientCache = new Map<string, SupabaseClient>();

   function loadProjectMap(): ProjectMap {
     if (_projectMap) return _projectMap;

     const raw = process.env.SUPABASE_PROJECTS;
     if (!raw || raw.trim() === '') {
       throw new Error(
         '[supabase] SUPABASE_PROJECTS env var is not set. ' +
         'Expected a JSON string: {"<projetoId>":{"url":"...","anonKey":"...","serviceKey":"..."}}'
       );
     }

     let parsed: unknown;
     try {
       parsed = JSON.parse(raw);
     } catch (err) {
       throw new Error(
         `[supabase] SUPABASE_PROJECTS is not valid JSON: ${(err as Error).message}. ` +
         'Expected shape: {"<projetoId>":{"url":"...","anonKey":"...","serviceKey":"..."}}'
       );
     }

     if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
       throw new Error('[supabase] SUPABASE_PROJECTS must be a JSON object mapping projetoId -> { url, anonKey, serviceKey }');
     }

     // Shallow-validate each entry
     for (const [id, cfg] of Object.entries(parsed as Record<string, unknown>)) {
       if (!cfg || typeof cfg !== 'object') {
         throw new Error(`[supabase] SUPABASE_PROJECTS entry "${id}" is not an object`);
       }
       const c = cfg as Partial<ProjectSupabaseConfig>;
       if (!c.url || !c.anonKey || !c.serviceKey) {
         throw new Error(
           `[supabase] SUPABASE_PROJECTS entry "${id}" is missing required fields. ` +
           'Each entry must have { url, anonKey, serviceKey }.'
         );
       }
     }

     _projectMap = parsed as ProjectMap;
     return _projectMap;
   }

   function getProjectConfig(projetoId: string): ProjectSupabaseConfig {
     const map = loadProjectMap();
     const cfg = map[projetoId];
     if (!cfg) {
       const known = Object.keys(map).join(', ') || '(none)';
     throw new Error(
         `[supabase] Unknown projetoId "${projetoId}". Known ids in SUPABASE_PROJECTS: ${known}`
       );
     }
     return cfg;
   }

   /**
    * Returns a service-role SupabaseClient for the given projetoId.
    * Server-only — NEVER import this into client components: it exposes the service_role key.
    * Clients are memoized per projetoId for the lifetime of the Node process.
    */
   export function getSupabaseForProject(projetoId: string): SupabaseClient {
     const cached = _projectClientCache.get(projetoId);
     if (cached) return cached;

     const cfg = getProjectConfig(projetoId);
     const client = createClient(cfg.url, cfg.serviceKey, {
       auth: {
         persistSession: false,
         autoRefreshToken: false,
       },
     });
     _projectClientCache.set(projetoId, client);
     return client;
   }

   /**
    * Returns the public (url, anonKey) pair for the given projetoId.
    * Safe to hand to browser/frontend code — does NOT expose the service key.
    */
   export function getSupabaseAnonKeyForProject(projetoId: string): { url: string; anonKey: string } {
     const cfg = getProjectConfig(projetoId);
     return { url: cfg.url, anonKey: cfg.anonKey };
   }
   ```

CRITICAL constraints:
- DO NOT refactor the legacy `getSupabase()` body or the `supabase` Proxy — they are load-bearing for 36 files (per D-Legacy: backward compatibility during migration).
- DO NOT import this new API anywhere else in this plan (no call-site migration).
- All new state (`_projectMap`, `_projectClientCache`) must be module-scoped (lives for the process lifetime, re-parsed on cold start only).
- The service-role client MUST disable session persistence and auto-refresh (per task_details constraint).
- Error messages MUST be prefixed with `[supabase]` and name the offending env var / projetoId so failures are debuggable in worker logs.
- File must remain a single TypeScript module with no runtime side effects beyond the existing legacy lazy-init pattern.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p . 2>&1 | grep -E "(lib/supabase|error TS)" || echo "TSC clean for lib/supabase.ts"</automated>
    Additional manual spot checks after running tsc:
    - `grep -n "export function getSupabase\b" lib/supabase.ts` returns the legacy function (still present).
    - `grep -n "export const supabase = new Proxy" lib/supabase.ts` returns the legacy Proxy (still present).
    - `grep -n "export function getSupabaseForProject" lib/supabase.ts` returns the new function.
    - `grep -n "export function getSupabaseAnonKeyForProject" lib/supabase.ts` returns the new function.
    - `grep -n "export type ProjectSupabaseConfig" lib/supabase.ts` returns the new type.
    - `grep -n "persistSession: false" lib/supabase.ts` confirms auth options passed to createClient.
  </verify>
  <done>
    - `lib/supabase.ts` compiles with no new TypeScript errors (`npx tsc --noEmit -p .` shows no errors originating in this file).
    - Legacy exports `getSupabase` and `supabase` are byte-identical in behavior (same env var reads, same error message, same Proxy wrapper).
    - New exports `getSupabaseForProject`, `getSupabaseAnonKeyForProject`, and type `ProjectSupabaseConfig` are present.
    - New API throws with `[supabase]` prefixed messages for: unset env, malformed JSON, non-object JSON, entry missing fields, unknown projetoId.
    - No call sites modified (worktrees excluded).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add SUPABASE_PROJECTS to .env (preserve all other vars verbatim)</name>
  <files>.env</files>
  <action>
Update `.env` to add `SUPABASE_PROJECTS` and annotate the legacy Supabase vars as legacy/fallback. PRESERVE every other line verbatim (including whitespace, comments, and the commented-out proxy block at the bottom).

Target file content (use this exact structure — values for legacy vars MUST be copied verbatim from the current `.env` on disk; do not substitute, regenerate, or omit them):

```
# SUPABASE
## AI DATA

# --- Legacy single-tenant vars (kept for backward compatibility during multi-tenant migration) ---
# These are still read by the legacy getSupabase() / supabase Proxy export in lib/supabase.ts.
# New code should prefer getSupabaseForProject(projetoId) which reads SUPABASE_PROJECTS below.
NEXT_PUBLIC_SUPABASE_URL=<copy current value verbatim>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy current value verbatim>
SUPABASE_SERVICE_ROLE_KEY=<copy current value verbatim>

# --- Multi-tenant map (Opção A — static JSON). Read by getSupabaseForProject() in lib/supabase.ts. ---
# Shape: {"<projetoId>":{"url":"https://x.supabase.co","anonKey":"...","serviceKey":"..."}}
# Must be a single-line JSON string. Add one entry per projeto. The projetoId key must match
# the UUID used in the projetos table.
# Example (replace with real values before running workers that use multi-tenant API):
# SUPABASE_PROJECTS={"proj-uuid-1":{"url":"https://x.supabase.co","anonKey":"eyJ...","serviceKey":"eyJ..."}}
SUPABASE_PROJECTS=

##Seu Elias



ENCRYPTION_KEY=<copy current value verbatim>

# Docker Infrastructure (Phase 4)
REDIS_URL=<copy current value verbatim>
BROWSERLESS_WS_ENDPOINT=<copy current value verbatim>

RESEND_API_KEY=<copy current value verbatim>
ALERT_EMAIL=<copy current value verbatim>
RESEND_FROM_EMAIL=<copy current value verbatim>


BULLBOARD_USER=<copy current value verbatim>
BULLBOARD_PASS=<copy current value verbatim>

# PROXY_SERVER=http://104.252.81.17:5888
# PROXY_USERNAME=lzrldpsg'
# PROXY_PASSWORD=0uw6l6wk2bp8
```

Steps:
1. Read the current `.env` with the Read tool.
2. For each `<copy current value verbatim>` placeholder above, substitute the real value from the file on disk. DO NOT invent, regenerate, or "fix" any value — copy the existing bytes exactly.
3. Add `SUPABASE_PROJECTS=` as an empty value (the user will populate it out-of-band when they're ready to wire multi-tenant). The legacy getSupabase() path will keep working regardless.
4. Do NOT create `.env.example` — the repo has no existing `.env.example` (confirmed via `ls`). That bullet from task_details is a no-op.

CRITICAL:
- Leaving `SUPABASE_PROJECTS=` empty is intentional: `getSupabaseForProject()` will throw with a clear error IF called while unset, but legacy code paths are unaffected.
- Do NOT remove or modify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` values. The legacy Proxy export depends on them and 36 files use it.
- Do NOT reorder unrelated blocks (Docker, Resend, Bull Board, proxy comments) — preserve their relative order.
- Do NOT expose the values in the final summary or any commit message.
  </action>
  <verify>
    <automated>grep -c "^NEXT_PUBLIC_SUPABASE_URL=" .env && grep -c "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env && grep -c "^SUPABASE_SERVICE_ROLE_KEY=" .env && grep -c "^SUPABASE_PROJECTS=" .env && grep -c "^ENCRYPTION_KEY=" .env && grep -c "^REDIS_URL=" .env && grep -c "^BROWSERLESS_WS_ENDPOINT=" .env && grep -c "^RESEND_API_KEY=" .env && grep -c "^BULLBOARD_USER=" .env</automated>
    Each grep must print `1`. Any `0` means a legacy var was accidentally dropped or renamed.
    Additional manual check: diff the current `.env` against the pre-edit version and confirm the only added lines are (a) the legacy-annotation comment block, (b) the multi-tenant comment block, and (c) the `SUPABASE_PROJECTS=` line. No value lines should have changed.
  </verify>
  <done>
    - `.env` contains `SUPABASE_PROJECTS=` (empty value is acceptable).
    - All 9 pre-existing env var lines (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, REDIS_URL, BROWSERLESS_WS_ENDPOINT, RESEND_API_KEY, ALERT_EMAIL, RESEND_FROM_EMAIL, BULLBOARD_USER, BULLBOARD_PASS) still present with their original values byte-for-byte.
    - Comment blocks document the legacy vs. multi-tenant distinction and show the JSON shape example.
    - Commented proxy block at bottom preserved verbatim.
    - No `.env.example` created (file did not previously exist).
    - No secrets printed in summary, logs, or commit messages.
  </done>
</task>

</tasks>

<verification>
Overall plan verification (run after both tasks complete):

1. TypeScript compiles clean:
   ```
   npx tsc --noEmit -p .
   ```
   No new errors in `lib/supabase.ts`. Pre-existing errors elsewhere (if any) are out of scope.

2. Legacy import path still resolves for a sample caller (smoke check — no code change):
   ```
   grep -l "from '@/lib/supabase'" app/api/projetos/list/route.ts
   ```
   Confirms the Proxy export is still the same symbol consumers imported.

3. New API surface is exported:
   ```
   grep -n "export" lib/supabase.ts
   ```
   Must show: `getSupabase`, `supabase`, `getSupabaseForProject`, `getSupabaseAnonKeyForProject`, `ProjectSupabaseConfig`.

4. Error handling smoke test (optional, executor may run via node repl or a throwaway script — DO NOT commit the script):
   ```
   SUPABASE_PROJECTS='not-json' npx tsx -e "import('./lib/supabase.ts').then(m => { try { m.getSupabaseForProject('x'); } catch (e) { console.log('OK:', e.message); } })"
   ```
   Expected: prints `OK: [supabase] SUPABASE_PROJECTS is not valid JSON: ...`

5. `.env` integrity:
   ```
   wc -l .env
   ```
   Line count should be roughly the original + ~10 lines (comment annotations + SUPABASE_PROJECTS line). No legacy values mutated.
</verification>

<success_criteria>
- `lib/supabase.ts` exports both legacy API (`getSupabase`, `supabase`) and new multi-tenant API (`getSupabaseForProject`, `getSupabaseAnonKeyForProject`, `ProjectSupabaseConfig`).
- All 36 existing call sites importing from `@/lib/supabase` remain untouched and continue to compile.
- `SUPABASE_PROJECTS` env var is documented and added to `.env` with a clear JSON-shape example comment.
- Legacy env vars remain in `.env` byte-identical to their pre-refactor values.
- `getSupabaseForProject('<unknown>')` throws a `[supabase] Unknown projetoId "..."` error naming all known ids.
- `getSupabaseForProject(id)` returns a memoized client (same reference on second call with same id).
- Service-role client is created with `auth: { persistSession: false, autoRefreshToken: false }`.
- Service-role keys are NEVER referenced in `getSupabaseAnonKeyForProject`'s return value.
- No secrets exposed in the SUMMARY or commit message.
</success_criteria>

<output>
After completion, create `.planning/quick/260410-mor-refatorar-lib-supabase-ts-para-suportar-/260410-mor-SUMMARY.md` with:
- What changed (file list, new exports)
- How to use the new API (1-2 code snippets: one for `getSupabaseForProject`, one for `getSupabaseAnonKeyForProject`)
- Migration note: "36 call sites still use the legacy `getSupabase()` / `supabase` Proxy. A follow-up phase will migrate them to `getSupabaseForProject(projetoId)` where appropriate."
- Reminder: populate `SUPABASE_PROJECTS` in `.env` before any code path calls the new API.
- DO NOT include actual env var values or keys in the summary.
</output>
