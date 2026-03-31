# Instagram Scraper Pro — Multi-Projeto

## What This Is

Dashboard de scraping de Instagram que permite gerenciar múltiplos projetos/clientes. Cada projeto tem seus próprios alvos (targets) e dados de scraping isolados. Construído com Next.js, Puppeteer, e Supabase self-hosted.

## Core Value

Usuário pode selecionar um projeto e ver/executar scraping apenas dos alvos vinculados àquele projeto, mantendo dados isolados entre clientes.

## Requirements

### Validated

- ✓ Scraping de posts, reels e carousels do Instagram — existing
- ✓ Seleção de conta/agente para login — existing
- ✓ Seleção de alvos (targets) com multi-select — existing
- ✓ Execução de scraping com feedback visual — existing
- ✓ Campo `projeto text null` já adicionado em todas as tabelas (exceto accounts) — existing

### Active

- [ ] Tabela `projetos` no Supabase para cadastro de projetos
- [ ] API para listar, criar e gerenciar projetos
- [ ] Seletor de projeto no frontend (antes de tudo)
- [ ] Botão para adicionar novos projetos
- [ ] TargetSelector filtrado pelo projeto selecionado
- [ ] API de targets filtrada por projeto
- [ ] Scraping vinculado ao projeto selecionado
- [ ] AccountSelector permanece compartilhado (sem filtro de projeto)

### Out of Scope

- Migração de dados existentes para um projeto — pode ser feita manualmente depois
- Permissões/autenticação por projeto — não necessário agora
- Dashboard de analytics por projeto — futuro

## Context

- Stack: Next.js 16, Puppeteer Core + @sparticuz/chromium, Supabase (self-hosted), TypeScript, Tailwind CSS
- O banco já tem o campo `projeto` em todas as tabelas relevantes (exceto `accounts`)
- A tabela `accounts` é compartilhada entre todos os projetos (agentes são globais)
- Frontend atual: page.tsx com AccountSelector, TargetSelector, LoginButton, ScrapeButton
- APIs existentes: /api/accounts/list, /api/targets/list, /api/scrape, etc.

## Constraints

- **Tech stack**: Manter Next.js + Supabase existente
- **Backward compatibility**: O campo `projeto` é nullable, dados sem projeto devem continuar acessíveis
- **UX**: Seleção de projeto deve ser o primeiro passo, antes de selecionar agente e alvos

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Campo `projeto` como text (não FK) | Flexibilidade, já implementado pelo usuário | — Pending |
| Accounts compartilhadas entre projetos | Agentes são recursos globais, não pertencem a um cliente | ✓ Good |
| Tabela `projetos` separada | Permite gerenciar metadata dos projetos (nome, criação, etc.) | — Pending |

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
*Last updated: 2026-03-31 after initialization*
