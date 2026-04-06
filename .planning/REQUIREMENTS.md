# Requirements: Instagram Scraper Pro

**Defined:** 2026-04-06
**Core Value:** Scraping confiavel e escalavel via API assincrona com filas e workers dedicados

## v1.0 Requirements (Complete)

### Backend / Database

- [x] **DB-01**: Tabela `projetos` criada no Supabase
- [x] **DB-02**: API GET /api/projetos/list
- [x] **DB-03**: API POST /api/projetos/create
- [x] **DB-04**: API GET /api/targets/list com filtro por projeto

### Frontend — Seletor de Projeto

- [x] **UI-01**: Componente ProjectSelector exibido antes de qualquer outra selecao
- [x] **UI-02**: ProjectSelector lista todos os projetos disponiveis
- [x] **UI-03**: Botao "Novo Projeto" para criar projeto inline
- [x] **UI-04**: Projeto selecionado visualmente destacado

### Frontend — Integracao

- [ ] **INT-01**: TargetSelector filtra alvos por projeto
- [ ] **INT-02**: AccountSelector permanece inalterado
- [ ] **INT-03**: ScrapeButton envia projeto junto com request
- [ ] **INT-04**: Layout: Projeto > Agente > Alvos > Execucao

## v2.0 Requirements (Current Milestone)

### Infrastructure

- [ ] **INFRA-01**: Docker Compose orquestra todos os servicos (app, Redis, Browserless, workers, Bull Board)
- [ ] **INFRA-02**: Dockerfile containeriza a aplicacao Next.js
- [ ] **INFRA-03**: Redis container disponivel como backend para filas BullMQ
- [ ] **INFRA-04**: Bull Board acessivel via web para monitorar filas e jobs

### Queues & Workers

- [ ] **QUEUE-01**: Fila `profile-scrape` processa extracao de bio, highlights e lista de posts por perfil
- [ ] **QUEUE-02**: Fila `post-details` processa extracao de likes, comments, video e carousel por post
- [ ] **QUEUE-03**: Worker de profile enfileira posts individuais na fila `post-details` apos extrair lista
- [ ] **QUEUE-04**: Workers possuem retry automatico com backoff exponencial em caso de falha
- [ ] **QUEUE-05**: Rate limiting nos workers respeita limites do Instagram (~2 requests/min)

### API

- [ ] **API-01**: POST /api/scrape aceita request e retorna 202 Accepted com jobId
- [ ] **API-02**: GET /api/jobs/:id retorna status, progresso e resultado do job
- [ ] **API-03**: GET /api/jobs lista jobs com filtro por projetoId e status

### Account Management

- [ ] **ACCT-01**: Sistema seleciona automaticamente conta com cookie valido (round-robin por last_used_at)
- [ ] **ACCT-02**: Se cookie falha durante scraping, marca conta como cookie_valid=false e tenta proxima
- [ ] **ACCT-03**: Se nenhuma conta disponivel, envia email via Resend com alerta e instrucoes
- [ ] **ACCT-04**: Job volta para fila com delay de 30min quando sem conta disponivel

### Login & Cookies

- [ ] **LOGIN-01**: Pagina /admin/login-session exibe browser Browserless embutido apontando para Instagram
- [ ] **LOGIN-02**: Usuario pode fazer login manualmente no Instagram via browser embutido
- [ ] **LOGIN-03**: Botao "Capturar Cookies" extrai cookies da sessao, encripta e salva no banco
- [ ] **LOGIN-04**: Conta marcada como cookie_valid=true e is_active=true apos captura

## Future Requirements

### Gestao de Projetos

- **MGMT-01**: Editar nome de projeto existente
- **MGMT-02**: Arquivar/desativar projeto
- **MGMT-03**: Dashboard de metricas por projeto

### Escala

- **SCALE-01**: Multiplos workers horizontais
- **SCALE-02**: Pool de contas com priorizacao
- **SCALE-03**: Agendamento de scraping periodico (cron)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Horizontal scaling (multiplos VPS) | Comecar com 1 VPS, escalar depois |
| Bull Board customizado | Usar Bull Board padrao |
| Autenticacao/permissoes | Single-user, desnecessario agora |
| Mobile app | Web-first |
| Proxy rotation | Futuro, quando rate limiting for problema |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| UI-01 | Phase 2 | Complete |
| UI-02 | Phase 2 | Complete |
| UI-03 | Phase 2 | Complete |
| UI-04 | Phase 2 | Complete |
| INT-01 | Phase 3 | Pending |
| INT-02 | Phase 3 | Pending |
| INT-03 | Phase 3 | Pending |
| INT-04 | Phase 3 | Pending |
| INFRA-01 | Phase 4 | Pending |
| INFRA-02 | Phase 4 | Pending |
| INFRA-03 | Phase 4 | Pending |
| INFRA-04 | Phase 4 | Pending |
| QUEUE-01 | Phase 5 | Pending |
| QUEUE-02 | Phase 5 | Pending |
| QUEUE-03 | Phase 5 | Pending |
| QUEUE-04 | Phase 5 | Pending |
| QUEUE-05 | Phase 5 | Pending |
| ACCT-01 | Phase 5 | Pending |
| ACCT-02 | Phase 5 | Pending |
| ACCT-04 | Phase 5 | Pending |
| API-01 | Phase 6 | Pending |
| API-02 | Phase 6 | Pending |
| API-03 | Phase 6 | Pending |
| ACCT-03 | Phase 6 | Pending |
| LOGIN-01 | Phase 7 | Pending |
| LOGIN-02 | Phase 7 | Pending |
| LOGIN-03 | Phase 7 | Pending |
| LOGIN-04 | Phase 7 | Pending |

**Coverage:**
- v1.0 requirements: 12 total (8 complete, 4 pending)
- v2.0 requirements: 20 total
- Mapped to phases: 20/20
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after v2.0 roadmap creation*
