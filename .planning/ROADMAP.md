# Roadmap: Instagram Scraper Pro

## Milestones

- ✅ **v1.0 Multi-Projeto** - Phases 1-3 (multi-project support)
- 🚧 **v2.0 API Queue System** - Phases 4-7 (async queues, workers, Docker)

## Phases

<details>
<summary>v1.0 Multi-Projeto (Phases 1-3)</summary>

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

</details>

### 🚧 v2.0 API Queue System (In Progress)

**Milestone Goal:** Migrar scraping de sincrono/serverless para sistema assincrono com filas BullMQ, workers dedicados, e infraestrutura Docker Compose.

**Phase Numbering:**
- Integer phases (4, 5, 6, 7): Planned milestone work
- Decimal phases (4.1, 5.1): Urgent insertions (marked with INSERTED)

- [ ] **Phase 4: Infrastructure Foundation** - Docker Compose, Redis, Browserless containers and app Dockerfile
- [ ] **Phase 5: Queue System & Workers** - BullMQ queues, profile/post workers with retry, rate-limiting, and account selection
- [ ] **Phase 6: API & Notifications** - Async REST endpoints, job status polling, Resend email alerts
- [ ] **Phase 7: Login Page & Cookies** - Browserless login UI for manual Instagram login and cookie capture

## Phase Details

### Phase 4: Infrastructure Foundation
**Goal**: All services run as containers via Docker Compose, with Redis and Browserless available as shared infrastructure
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts all services (app, Redis, Browserless, Bull Board) without errors
  2. The Next.js app runs inside a container and serves pages at localhost
  3. Redis is reachable from the app container and accepts BullMQ connections
  4. Bull Board web UI is accessible via browser and shows empty queue dashboards
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Dockerfile, docker-compose.yml, Redis and Browserless containers
- [ ] 04-02-PLAN.md — BullMQ queues, Bull Board UI at /admin/queues, dev compose override

### Phase 5: Queue System & Workers
**Goal**: Scraping jobs are processed asynchronously by dedicated workers with automatic account selection, retry logic, and Instagram rate-limit compliance
**Depends on**: Phase 4
**Requirements**: QUEUE-01, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05, ACCT-01, ACCT-02, ACCT-04
**Success Criteria** (what must be TRUE):
  1. A profile-scrape job extracts bio, highlights, and post list, then automatically enqueues individual post-details jobs
  2. A post-details job extracts likes, comments, video URL, and carousel images for a single post
  3. Workers automatically pick the next available account via round-robin and fall back to the next account if cookies are invalid
  4. Failed jobs are retried with exponential backoff, and jobs without available accounts are re-queued with a 30-minute delay
  5. Workers throttle requests to respect Instagram rate limits (~2 requests/min per account)
**Plans**: TBD

### Phase 6: API & Notifications
**Goal**: External consumers can trigger scraping via REST API and monitor job progress, with email alerts when no accounts are available
**Depends on**: Phase 5
**Requirements**: API-01, API-02, API-03, ACCT-03
**Success Criteria** (what must be TRUE):
  1. POST /api/scrape accepts a scrape request and returns 202 Accepted with a jobId
  2. GET /api/jobs/:id returns the current status, progress percentage, and result of a specific job
  3. GET /api/jobs returns a filtered list of jobs by projetoId and/or status
  4. When no accounts with valid cookies are available, an email is sent via Resend with alert and instructions
**Plans**: TBD

### Phase 7: Login Page & Cookies
**Goal**: Admin can manually log into Instagram through an embedded browser and capture session cookies to restore scraping capability
**Depends on**: Phase 4 (Browserless container)
**Requirements**: LOGIN-01, LOGIN-02, LOGIN-03, LOGIN-04
**Success Criteria** (what must be TRUE):
  1. Page /admin/login-session displays a Browserless-powered embedded browser pointing to Instagram login
  2. User can interact with the embedded browser to complete Instagram login (typing, clicking, 2FA)
  3. Clicking "Capturar Cookies" extracts cookies from the session, encrypts them, and saves to the database
  4. After cookie capture, the account is marked as cookie_valid=true and is_active=true, making it available for workers
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 2/2 | Complete | - |
| 2. Project Selector | v1.0 | 1/1 | Complete | - |
| 3. Integration | v1.0 | 0/1 | Not started | - |
| 4. Infrastructure Foundation | v2.0 | 0/2 | Planning | - |
| 5. Queue System & Workers | v2.0 | 0/? | Not started | - |
| 6. API & Notifications | v2.0 | 0/? | Not started | - |
| 7. Login Page & Cookies | v2.0 | 0/? | Not started | - |
