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

/**
 * Returns the appropriate Supabase client for a job based on projetoId.
 *
 * - If projetoId is a non-empty string: routes to the tenant-specific client
 *   via getSupabaseForProject().
 * - If projetoId is null/undefined/empty string: falls back to the legacy
 *   getSupabase() client (backward compat for jobs enqueued before
 *   multi-tenant support).
 *
 * Use this inside worker job processors where projetoId comes from job.data
 * and may be null for legacy jobs still in the queue.
 */
export function getSupabaseForJob(projetoId: string | null | undefined): SupabaseClient {
  if (projetoId && projetoId.trim() !== '') {
    return getSupabaseForProject(projetoId);
  }
  return getSupabase();
}
