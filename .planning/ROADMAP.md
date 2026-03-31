# Roadmap: Instagram Scraper Pro — Multi-Projeto

## Overview

Add multi-project support to the existing Instagram scraper dashboard. The `projeto` field already exists in all relevant tables (nullable text). This roadmap delivers a `projetos` table, project management APIs, a frontend ProjectSelector component, and full integration so that targets, scraping, and layout are all project-aware. Three phases: backend foundation, frontend selector, then wiring everything together.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Foundation** - Projetos table and project-aware APIs
- [ ] **Phase 2: Project Selector** - Frontend component for selecting and creating projects
- [ ] **Phase 3: Integration** - Wire project context through targets, scraping, and layout

## Phase Details

### Phase 1: Backend Foundation
**Goal**: The system has a persistent registry of projects and APIs to manage them
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. A `projetos` table exists in Supabase with id, nome, and criado_em columns
  2. GET /api/projetos/list returns all registered projects as JSON
  3. POST /api/projetos/create creates a new project and returns it
  4. GET /api/targets/list?projeto=X returns only targets matching that project
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Projetos table creation + list/create API routes
- [x] 01-02-PLAN.md — Add projeto filter to targets list API

### Phase 2: Project Selector
**Goal**: User can see, select, and create projects directly in the dashboard
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. A ProjectSelector component appears at the top of the dashboard before account and target selection
  2. The selector lists all projects fetched from the API
  3. User can create a new project inline without leaving the page
  4. The currently selected project is visually highlighted and stored in component state
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — ProjectSelector component + page.tsx integration

### Phase 3: Integration
**Goal**: The entire scraping workflow respects the selected project -- targets filtered, scrape requests tagged, layout reordered
**Depends on**: Phase 2
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. TargetSelector shows only targets belonging to the selected project
  2. AccountSelector remains unchanged and shared across all projects
  3. Clicking Scrape sends the selected project along with the request payload
  4. Dashboard layout follows the order: Project > Agent > Targets > Execute
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [ ] 03-01-PLAN.md — Wire selectedProjetoId through TargetSelector, ScrapeButton, and page.tsx

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 2/2 | Complete | - |
| 2. Project Selector | 0/1 | Not started | - |
| 3. Integration | 0/1 | Not started | - |
