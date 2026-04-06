# Phase 4: Infrastructure Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Containerize the Next.js app and stand up shared infrastructure (Redis, Browserless, Bull Board) via Docker Compose. All services start with a single `docker compose up` command. This phase does NOT include workers or queue logic — only the infrastructure they will run on.

</domain>

<decisions>
## Implementation Decisions

### Environment Configuration
- **D-01:** Single `.env` file shared by all containers via Docker Compose `env_file` directive. Extend the existing `.env` with Redis URL and any new variables. No separate env files per service.

### Bull Board Integration
- **D-02:** Bull Board mounted as a route inside the Next.js app at `/admin/queues` using `@bull-board/api` + `@bull-board/next-adapter`. No separate Bull Board container.

### Docker Compose Strategy
- **D-03:** Single `docker-compose.yml` for production with `docker-compose.override.yml` for dev extras (volume mounts for hot-reload, debug ports). Standard Docker override pattern.

### Redis Persistence
- **D-04:** Ephemeral Redis — no volume mount. Jobs are transient and can be re-triggered. Simpler setup, no backup concerns.

### Prior Decisions (from milestone planning)
- **D-05:** BullMQ + Redis chosen over RabbitMQ (TypeScript native, simpler)
- **D-06:** Browserless Docker container for embedded browser (Instagram blocks iframes)
- **D-07:** Docker Compose deployment target (workers need persistent process, not serverless)

### Claude's Discretion
- Dockerfile optimization (multi-stage builds, layer caching)
- Port assignments for services
- Healthcheck configuration
- Network setup between containers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration
- `package.json` — Current dependencies (Next.js 16.1.4, puppeteer-core, @sparticuz/chromium)
- `next.config.ts` — Server external packages config, output file tracing for chromium
- `.env` — Existing environment variables (Supabase keys, encryption key)
- `supabase_schema.sql` — Full database schema

### Planning
- `.planning/PROJECT.md` — Project context and key decisions
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-04 requirements
- `.planning/ROADMAP.md` — Phase 4 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase.ts` — Supabase client, will be used by workers too
- `lib/browser.ts` — Puppeteer browser setup, currently uses @sparticuz/chromium (will switch to Browserless WS endpoint in containers)
- `lib/encryption.ts` — Cookie encryption, shared across app and workers

### Established Patterns
- Next.js App Router with API routes at `app/api/`
- `serverExternalPackages: ['@sparticuz/chromium']` in next.config — may change when using Browserless
- Dev uses `next dev --webpack` (not turbopack)

### Integration Points
- Bull Board route at `app/api/admin/queues` or via Next.js custom server adapter
- Redis connection shared between app (for Bull Board) and workers (for job processing)
- Workers will import from `lib/` (scraper, extraction, supabase, encryption)
- Browserless container replaces @sparticuz/chromium for browser access

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Docker/Redis/Browserless setup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-infrastructure-foundation*
*Context gathered: 2026-04-06*
