# Instagram Scraper Pro

## What This Is

Plataforma de scraping de Instagram com gerenciamento de múltiplos projetos/clientes. Cada projeto tem alvos isolados. Sistema assíncrono com filas de processamento, workers dedicados, e infraestrutura Docker auto-hospedada. Construído com Next.js, Puppeteer, BullMQ, Redis, e Supabase self-hosted.

## Core Value

Scraping confiável e escalável via API assíncrona — requisições são enfileiradas e processadas por workers dedicados, com seleção automática de conta e notificação quando intervenção humana é necessária.

## Current Milestone: v2.0 API Queue System

**Goal:** Migrar o scraping de síncrono/serverless para sistema assíncrono com filas, workers dedicados, e infraestrutura Docker.

**Target features:**
- API REST assíncrona (retorna 202 Accepted + jobId)
- Fila `profile-scrape` com BullMQ (bio, highlights, lista de posts)
- Fila `post-details` com BullMQ (likes, comments, video, carousel)
- Seleção automática de conta com round-robin e fallback
- Notificação via Resend quando nenhuma conta disponível
- Página de login com browser embutido (Browserless) para captura de cookies
- Docker Compose (app + Redis + Browserless + workers + Bull Board)
- API de polling de status (GET /api/jobs/:id)

## Requirements

### Validated

- ✓ Scraping de posts, reels e carousels do Instagram — existing
- ✓ Seleção de conta/agente para login — existing
- ✓ Seleção de alvos (targets) com multi-select — existing
- ✓ Execução de scraping com feedback visual (SSE) — existing
- ✓ Campo `projeto` em todas as tabelas relevantes — v1.0
- ✓ Tabela `projetos` + APIs de gerenciamento — v1.0 Phase 1
- ✓ Seletor de projeto no frontend — v1.0 Phase 2
- ✓ Extração de bio, highlights (URL/título/cover) — existing
- ✓ Extração de likes e comments por post — existing
- ✓ Tabela `scrapper_accounts` com `cookie_valid` e `failed_attempts` — existing

### Active

- [ ] API REST assíncrona com filas BullMQ
- [ ] Workers dedicados para profile-scrape e post-details
- [ ] Seleção automática de conta com fallback
- [ ] Notificação via Resend quando sem conta disponível
- [ ] Página de login com Browserless para captura de cookies
- [ ] Docker Compose para toda infraestrutura
- [ ] API de polling de status de jobs

### Out of Scope

- Migração de dados existentes para um projeto — manual
- Permissões/autenticação por projeto — futuro
- Dashboard de analytics por projeto — futuro
- Horizontal scaling com múltiplos VPS — futuro, começar com 1 VPS
- Interface web para Bull Board customizada — usar Bull Board padrão

## Context

- Stack atual: Next.js 16, Puppeteer Core + @sparticuz/chromium, Supabase (self-hosted), TypeScript, Tailwind CSS
- Deploy atual em Vercel (serverless, max 300s timeout) — migrando para Docker/VPS
- `scraper.ts` e `extraction.ts` já modularizados e testados
- `scrapper_accounts` já tem `cookie_valid`, `failed_attempts`, `is_active`
- Scraping roda síncrono no HTTP request — será refatorado para workers
- Rate limiting do Instagram é o gargalo real (~100 req/hora por conta)

## Constraints

- **Tech stack**: Manter Next.js + Supabase existente, adicionar BullMQ + Redis + Browserless
- **Deploy**: Docker Compose em VPS (Hetzner/DigitalOcean, ~$5-15/mês)
- **Instagram rate limits**: Max ~100 requests/hora por conta, necessário round-robin
- **Backward compatibility**: Frontend existente deve continuar funcionando durante migração

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BullMQ + Redis ao invés de RabbitMQ | Menor complexidade, TypeScript nativo, retry/rate-limit built-in | — Pending |
| 2 filas (profile + post) ao invés de 5 | 1 fila = 1 navegação de browser, separar mais = overhead desnecessário | — Pending |
| Browserless para login ao invés de cookie manual | Instagram bloqueia iframes, precisa browser real no servidor | — Pending |
| Docker Compose ao invés de Vercel | Workers precisam de processo persistente, Vercel não suporta | — Pending |
| Resend para notificações | Simples, API REST, bom free tier | — Pending |
| Accounts compartilhadas entre projetos | Agentes são recursos globais, não pertencem a um cliente | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after milestone v2.0 initialization*
