# Guia de Acesso — AI Data Platform

Ambiente de produção em `https://aidata.devops-apogeu.uk`

---

## 1. Hub Principal

**URL:** `https://aidata.devops-apogeu.uk`

Página de entrada do sistema. Acesso livre (sem login). Lista todas as funcionalidades disponíveis com links diretos para cada uma.

---

## 2. Dashboard de Scraping (legado)

**URL:** `https://aidata.devops-apogeu.uk/old`

Painel para selecionar projeto, conta e alvos e disparar jobs de scraping manualmente via interface.

---

## 3. Login de Sessão Instagram

**URL:** `https://aidata.devops-apogeu.uk/admin/login-session`

Permite fazer login manual em uma conta do Instagram e capturar os cookies de sessão. Os cookies são salvos automaticamente no banco e usados pelos workers para scraping.

**Como usar:**
1. Acesse a URL acima
2. Selecione a conta no dropdown
3. Faça login normalmente no navegador que aparece na tela
4. Clique em **Capturar Cookies** após o login ser concluído

> Sem login necessário para acessar a página.

---

## 4. BullBoard — Monitoramento de Filas

**URL:** `https://aidata.devops-apogeu.uk/admin/queues`

Dashboard para visualizar o estado das filas de processamento (jobs pendentes, em execução, falhos, concluídos).

**Login:** autenticação básica HTTP
- **Usuário:** definido na variável `BULLBOARD_USER` do `.env`
- **Senha:** definido na variável `BULLBOARD_PASS` do `.env`

> Consulte Igor para obter as credenciais.

---

## 5. Dozzle — Logs dos Containers

**URL:** `http://aidata.devops-apogeu.uk:9999`

Visualizador de logs em tempo real de todos os containers Docker (app, workers, redis, browserless etc.).

**Login:** autenticação básica HTTP
- **Usuário:** `admin`
- **Senha:** `Tria@2026`

> Atenção: acesso via `http://` (sem SSL).

---

## 6. Netdata — Métricas do Servidor

**URL:** `http://aidata.devops-apogeu.uk:19999`

Monitoramento de CPU, memória, disco e rede do servidor em tempo real.

**Login:** autenticação básica HTTP
- **Usuário:** `admin`
- **Senha:** `Tria@2026`

> Atenção: acesso via `http://` (sem SSL).

---

## 7. API de Scraping

**Endpoint:** `POST https://aidata.devops-apogeu.uk/api/scrape`

Enfileira jobs de scraping de perfis do Instagram.

**Body:**
```json
{
  "targetUsernames": ["perfil1", "perfil2"],
  "projetoId": "uuid-do-projeto",
  "accountId": "uuid-da-conta",
  "maxPosts": 50
}
```

**Resposta:**
```json
{
  "jobIds": ["1", "2"],
  "status": "queued",
  "count": 2
}
```

> `maxPosts` é opcional. Padrão: 50 posts por perfil.
> `accountId` é opcional. Se omitido, o sistema seleciona automaticamente uma conta disponível.

### Outras rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/jobs` | Lista todos os jobs |
| `GET` | `/api/jobs/[id]` | Status de um job específico |
| `GET` | `/api/accounts/list` | Lista contas cadastradas |
| `GET` | `/api/targets/list` | Lista targets de scraping |
| `POST` | `/api/targets/create` | Cria novo target |
| `GET` | `/api/projetos/list` | Lista projetos |
| `POST` | `/api/projetos/create` | Cria novo projeto |

---

## Resumo de Acessos

| Funcionalidade | URL | Login |
|----------------|-----|-------|
| Hub principal | `https://aidata.devops-apogeu.uk` | Sem login |
| Dashboard scraping | `https://aidata.devops-apogeu.uk/old` | Sem login |
| Login Instagram | `https://aidata.devops-apogeu.uk/admin/login-session` | Sem login |
| BullBoard (filas) | `https://aidata.devops-apogeu.uk/admin/queues` | Basic auth (ver Igor) |
| Dozzle (logs) | `http://aidata.devops-apogeu.uk:9999` | Basic auth — user: `admin` |
| Netdata (métricas) | `http://aidata.devops-apogeu.uk:19999` | Basic auth — user: `admin` |
| API scraping | `https://aidata.devops-apogeu.uk/api/scrape` | Sem login |
