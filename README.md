# 📸 Instagram Scraper & Archive

Este projeto é uma aplicação web desenvolvida em **Next.js** para realizar o scraping automatizado de perfis do Instagram, coletando posts, mídias (fotos e vídeos de Reels/Carrosséis) e armazenando-os em um banco de dados **Supabase**.

A aplicação foi otimizada para rodar em ambientes **Serverless** (como Vercel) utilizando **Puppeteer Core** e **@sparticuz/chromium**, com mecanismos robustos de login e evasão de detecção.

## 🚀 Funcionalidades

### 🔐 Autenticação e Sessão
- **Login Manual Assistido**: Interface para realizar login no Instagram através de um navegador remoto.
- **Armazenamento Seguro**: Cookies de sessão são criptografados antes de serem salvos no banco de dados.
- **Reutilização de Sessão**: O sistema reutiliza cookies para evitar logins repetitivos e checkpoints de segurança.
- **Bypass de Proteções**:
    - User-Agent realista (Chrome Desktop).
    - Detecção e clique automático em banners de cookies ("Allow", "Aceitar").
    - Estratégia de múltiplos seletores para encontrar campos de login (compatibilidade com UI variada).

### 🕷️ Scraping de Dados
- **Extração de Posts**: Coleta posts do feed de usuários alvo.
- **Suporte a Mídia Rica**:
    - **Reels**: Extrai a URL direta do vídeo.
    - **Carrosséis**: Coleta todas as imagens do carrossel.
    - **Alt Text**: Salva descrições de acessibilidade.
- **Detecção de Estado**: Identifica contas privadas ou falhas de carregamento e registra screenshots de debug em caso de erro.
- **Prevenção de Duplicatas**: Utiliza `UPSERT` para evitar gravar o mesmo post duas vezes.

## 🛠️ Tecnologias Utilizadas

- **Frontend/Framework**: [Next.js 16](https://nextjs.org/) (React 19)
- **Estilização**: Tailwind CSS v4.
- **Automação de Navegador**: 
    - `puppeteer-core`: Controle do navegador.
    - `@sparticuz/chromium`: Binário do Chromium otimizado para AWS Lambda/Vercel (Serverless).
- **Banco de Dados**: [Supabase](https://supabase.com/) (PostgreSQL).
- **Ícones**: Lucide React.
- **Segurança**: Módulo nativo `crypto` do Node.js para criptografia de credenciais.

## 📦 Instalação e Execução

### Pré-requisitos
- Node.js 20+
- Conta no Supabase (com as tabelas `scrapper_accounts`, `scrappers_contents`, `users_scrapping` configuradas).

### Rodando Localmente

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/tria-company/social-media-scrapper.git
   cd social-media-scrapper
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente**:
   Crie um arquivo `.env.local` na raiz:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key_anon
   SUPABASE_SERVICE_ROLE_KEY=sua_key_service
   ENCRYPTION_KEY=chave_32_chars_hex
   ```

4. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000).

---

## ☁️ Deploy na Vercel

Este projeto está configurado para deploy na Vercel.

**Atenção para Limites Serverless:**
- O scraping roda em **Funções Serverless** com timeout limitado (padrão 10-60s).
- Para processos longos, recomenda-se configurar timeouts maiores no `vercel.json` ou usar filas externas.
- O navegador roda em modo `headless: true` obrigatório devido às restrições de ambiente.

## 📝 Estrutura do Código

- `lib/browser.ts`: Configuração do Puppeteer (Gerencia binários locais vs. serverless).
- `lib/scraper.ts`: Lógica principal de navegação, login e extração de dados.
- `lib/encryption.ts`: Utilitários de criptografia.
- `app/`: Páginas e rotas da API (Next.js App Router).
