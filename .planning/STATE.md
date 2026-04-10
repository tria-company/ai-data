---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: API Queue System
status: executing
stopped_at: Completed 07-01-PLAN.md
last_updated: "2026-04-10T00:00:00.000Z"
last_activity: 2026-04-10
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 8
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Scraping confiavel e escalavel via API assincrona com filas e workers dedicados
**Current focus:** Phase 07 — login-page-cookies

## Current Position

Phase: 07 (login-page-cookies) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-10 - Completed quick task 260410-nf7: workers routed via getSupabaseForJob

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v2.0)
- Average duration: --
- Total execution time: --

## Accumulated Context

### v1.0 Summary

- Delivered multi-project support (3 phases: backend, selector, integration)
- Scraper code is modular (scraper.ts, extraction.ts, browser.ts)
- SSE streaming for real-time logs implemented
- scrapper_accounts table has cookie_valid and failed_attempts columns
- Instagram DOM extraction strategies refined through multiple iterations

### Decisions

- BullMQ + Redis chosen over RabbitMQ (simpler, TypeScript native)
- 2 queues (profile + post) instead of 5 (1 queue = 1 browser navigation)
- Browserless for login instead of manual cookie import
- Docker Compose for deployment instead of Vercel (workers need persistent process)
- Resend for email notifications
- Accounts are shared across projects (global resources)
- [Phase 04]: Browserless mapped to host port 3333 (internal 3000) to avoid conflict with app
- [Phase 04]: Redis ephemeral with no volumes per D-04, standalone Next.js output for Docker
- [Phase 04]: Used @bull-board/express adapter (not next-adapter which doesn't exist) with Express-to-NextResponse bridge
- [Phase 05]: Workers decompose scrapeAccounts() into per-profile and per-post units with account selection loop
- [Phase 06]: Email failure logged but never thrown - notifications must not block worker execution
- [Phase 06-api-notifications]: accountId optional in POST /api/scrape; worker auto-selects via round-robin
- [Phase 06-api-notifications]: Job list: single-status queries infer state from BullMQ type bucket (no extra Redis calls)
- [Phase 07-01]: Socket.io path /api/socket/io avoids conflict with Next.js route; CDP screencast quality=60 jpeg at 1280x800; session cleanup uses silent try/catch for disconnect resilience

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260410-mor | Refatorar lib/supabase.ts para suportar multi-tenant Supabase via env var SUPABASE_PROJECTS | 2026-04-10 | b52bbc3 | [260410-mor-refatorar-lib-supabase-ts-para-suportar-](./quick/260410-mor-refatorar-lib-supabase-ts-para-suportar-/) |
| 260410-nf7 | Migrar profile-worker e post-worker para usar getSupabaseForJob (roteamento per-tenant) | 2026-04-10 | 643926a | [260410-nf7-migrar-profile-worker-e-post-worker-para](./quick/260410-nf7-migrar-profile-worker-e-post-worker-para/) |

## Session Continuity

Last session: 2026-04-10T00:00:00.000Z
Stopped at: Completed quick task 260410-nf7
Resume file: None
