# Requirements: Instagram Scraper Pro — Multi-Projeto

**Defined:** 2026-03-31
**Core Value:** Isolamento de dados por projeto com seleção simples no frontend

## v1 Requirements

Requirements para suporte multi-projeto. Cada um mapeia a fases do roadmap.

### Backend / Database

- [ ] **DB-01**: Tabela `projetos` criada no Supabase com campos: id (uuid), nome (text), criado_em (timestamp)
- [ ] **DB-02**: API GET /api/projetos/list retorna lista de todos os projetos
- [ ] **DB-03**: API POST /api/projetos/create permite criar novo projeto
- [ ] **DB-04**: API GET /api/targets/list aceita query param `projeto` e filtra resultados

### Frontend — Seletor de Projeto

- [ ] **UI-01**: Componente ProjectSelector exibido antes de qualquer outra seleção
- [ ] **UI-02**: ProjectSelector lista todos os projetos disponíveis
- [ ] **UI-03**: Botão "Novo Projeto" abre modal/input para criar projeto inline
- [ ] **UI-04**: Projeto selecionado é visualmente destacado e persistido no estado

### Frontend — Integração

- [ ] **INT-01**: TargetSelector recebe projeto selecionado e filtra alvos por projeto
- [ ] **INT-02**: AccountSelector permanece inalterado (sem filtro de projeto)
- [ ] **INT-03**: ScrapeButton envia o projeto selecionado junto com o request
- [ ] **INT-04**: Layout do dashboard reorganizado: Projeto > Agente > Alvos > Execução

## v2 Requirements

### Gestão de Projetos

- **MGMT-01**: Editar nome de projeto existente
- **MGMT-02**: Arquivar/desativar projeto
- **MGMT-03**: Associar targets existentes a um projeto via UI
- **MGMT-04**: Dashboard de métricas por projeto

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autenticação/permissões por projeto | Complexidade desnecessária agora, single-user |
| Migração automática de dados existentes | Pode ser feita manualmente via SQL |
| Múltiplos projetos simultâneos | Um projeto por vez é suficiente |
| CRUD completo de projetos (delete) | Risco de perda de dados, v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| INT-01 | Phase 3 | Pending |
| INT-02 | Phase 3 | Pending |
| INT-03 | Phase 3 | Pending |
| INT-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial definition*
