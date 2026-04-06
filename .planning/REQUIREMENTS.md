# Requirements: Instagram Scraper Pro

**Defined:** 2026-04-06
**Core Value:** Scraping confiável e escalável via API assíncrona com filas e workers dedicados

## v1.0 Requirements (Complete)

### Backend / Database

- [x] **DB-01**: Tabela `projetos` criada no Supabase
- [x] **DB-02**: API GET /api/projetos/list
- [x] **DB-03**: API POST /api/projetos/create
- [x] **DB-04**: API GET /api/targets/list com filtro por projeto

### Frontend — Seletor de Projeto

- [x] **UI-01**: Componente ProjectSelector exibido antes de qualquer outra seleção
- [x] **UI-02**: ProjectSelector lista todos os projetos disponíveis
- [x] **UI-03**: Botão "Novo Projeto" para criar projeto inline
- [x] **UI-04**: Projeto selecionado visualmente destacado

### Frontend — Integração

- [ ] **INT-01**: TargetSelector filtra alvos por projeto
- [ ] **INT-02**: AccountSelector permanece inalterado
- [ ] **INT-03**: ScrapeButton envia projeto junto com request
- [ ] **INT-04**: Layout: Projeto > Agente > Alvos > Execução

## v2.0 Requirements (Current Milestone)

### Infrastructure

- [ ] **INFRA-01**: Docker Compose orquestra todos os serviços (app, Redis, Browserless, workers, Bull Board)
- [ ] **INFRA-02**: Dockerfile containeriza a aplicação Next.js
- [ ] **INFRA-03**: Redis container disponível como backend para filas BullMQ
- [ ] **INFRA-04**: Bull Board acessível via web para monitorar filas e jobs

### Queues & Workers

- [ ] **QUEUE-01**: Fila `profile-scrape` processa extração de bio, highlights e lista de posts por perfil
- [ ] **QUEUE-02**: Fila `post-details` processa extração de likes, comments, video e carousel por post
- [ ] **QUEUE-03**: Worker de profile enfileira posts individuais na fila `post-details` após extrair lista
- [ ] **QUEUE-04**: Workers possuem retry automático com backoff exponencial em caso de falha
- [ ] **QUEUE-05**: Rate limiting nos workers respeita limites do Instagram (~2 requests/min)

### API

- [ ] **API-01**: POST /api/scrape aceita request e retorna 202 Accepted com jobId
- [ ] **API-02**: GET /api/jobs/:id retorna status, progresso e resultado do job
- [ ] **API-03**: GET /api/jobs lista jobs com filtro por projetoId e status

### Account Management

- [ ] **ACCT-01**: Sistema seleciona automaticamente conta com cookie válido (round-robin por last_used_at)
- [ ] **ACCT-02**: Se cookie falha durante scraping, marca conta como cookie_valid=false e tenta próxima
- [ ] **ACCT-03**: Se nenhuma conta disponível, envia email via Resend com alerta e instruções
- [ ] **ACCT-04**: Job volta para fila com delay de 30min quando sem conta disponível

### Login & Cookies

- [ ] **LOGIN-01**: Página /admin/login-session exibe browser Browserless embutido apontando para Instagram
- [ ] **LOGIN-02**: Usuário pode fazer login manualmente no Instagram via browser embutido
- [ ] **LOGIN-03**: Botão "Capturar Cookies" extrai cookies da sessão, encripta e salva no banco
- [ ] **LOGIN-04**: Conta marcada como cookie_valid=true e is_active=true após captura

## Future Requirements

### Gestão de Projetos

- **MGMT-01**: Editar nome de projeto existente
- **MGMT-02**: Arquivar/desativar projeto
- **MGMT-03**: Dashboard de métricas por projeto

### Escala

- **SCALE-01**: Múltiplos workers horizontais
- **SCALE-02**: Pool de contas com priorização
- **SCALE-03**: Agendamento de scraping periódico (cron)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Horizontal scaling (múltiplos VPS) | Começar com 1 VPS, escalar depois |
| Bull Board customizado | Usar Bull Board padrão |
| Autenticação/permissões | Single-user, desnecessário agora |
| Mobile app | Web-first |
| Proxy rotation | Futuro, quando rate limiting for problema |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| INFRA-04 | TBD | Pending |
| QUEUE-01 | TBD | Pending |
| QUEUE-02 | TBD | Pending |
| QUEUE-03 | TBD | Pending |
| QUEUE-04 | TBD | Pending |
| QUEUE-05 | TBD | Pending |
| API-01 | TBD | Pending |
| API-02 | TBD | Pending |
| API-03 | TBD | Pending |
| ACCT-01 | TBD | Pending |
| ACCT-02 | TBD | Pending |
| ACCT-03 | TBD | Pending |
| ACCT-04 | TBD | Pending |
| LOGIN-01 | TBD | Pending |
| LOGIN-02 | TBD | Pending |
| LOGIN-03 | TBD | Pending |
| LOGIN-04 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after milestone v2.0 initialization*
