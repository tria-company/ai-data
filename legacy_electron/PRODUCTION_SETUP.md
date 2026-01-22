# 📦 Configuração de Produção - Aplicação Instalada

Este guia explica como configurar a aplicação **Instagram Scraper** após fazer o build e instalar no seu sistema.

## 🚨 Problema Comum: "ENOTDIR: not a directory"

Se você recebeu este erro ao executar a aplicação instalada:

```
❌ Error: ENOTDIR: not a directory, mkdir '/Applications/Instagram Scraper.app/Contents/Resources/app.asar/ports/input'
```

**Isso foi corrigido!** A aplicação agora usa o diretório correto do usuário.

---

## 📁 Localização dos Arquivos em Produção

Quando você instala a aplicação, os arquivos de configuração e dados **NÃO ficam dentro do .app**, mas sim no diretório de dados do usuário:

### macOS
```
~/Library/Application Support/instagram-scraper/
├── .env                          # 🔑 Credenciais (você precisa criar)
├── ports/
│   ├── input/
│   │   └── input.csv            # CSV com contas do Instagram
│   ├── output/
│   │   ├── success.json         # Resultados bem-sucedidos
│   │   └── errors.json          # Erros de scraping
│   └── cookies/
│       └── instagram-cookies.json  # Sessão do Instagram
```

### Windows
```
%APPDATA%/instagram-scraper/
├── .env
├── ports/
│   └── (mesma estrutura acima)
```

### Linux
```
~/.config/instagram-scraper/
├── .env
├── ports/
│   └── (mesma estrutura acima)
```

---

## ⚙️ Configuração Inicial (IMPORTANTE!)

### 1️⃣ Abrir o Diretório de Configuração

#### macOS - Via Terminal:
```bash
open ~/Library/Application\ Support/instagram-scraper/
```

#### macOS - Via Finder:
1. Abra o Finder
2. Pressione `Cmd + Shift + G`
3. Cole: `~/Library/Application Support/instagram-scraper/`
4. Pressione Enter

#### Windows - Via Executar:
1. Pressione `Win + R`
2. Digite: `%APPDATA%\instagram-scraper`
3. Pressione Enter

#### Linux:
```bash
nautilus ~/.config/instagram-scraper/
# ou
xdg-open ~/.config/instagram-scraper/
```

---

### 2️⃣ Criar o Arquivo `.env`

Na primeira vez que você executar a aplicação, um arquivo `.env` de template será criado automaticamente.

**Edite este arquivo** e adicione suas credenciais do Instagram:

```env
# Instagram Account Credentials
INSTAGRAM_USERNAME=seu_usuario_instagram
INSTAGRAM_PASSWORD=sua_senha_instagram

# Application Settings
MAX_POSTS_PER_ACCOUNT=50
DELAY_BETWEEN_ACCOUNTS=3000
```

### 3️⃣ Salvar e Reiniciar

1. Salve o arquivo `.env`
2. Feche a aplicação completamente
3. Abra novamente

---

## 🔍 Como Verificar se Está Funcionando

Ao abrir a aplicação, verifique os logs no console (se você habilitou o DevTools) ou nos logs do sistema:

### Mensagens de Sucesso:
```
[Paths] Application data directory: /Users/seu-usuario/Library/Application Support/instagram-scraper
[Paths] Ports directory: /Users/seu-usuario/Library/Application Support/instagram-scraper/ports
[Config] Loaded .env from userData: /Users/seu-usuario/Library/Application Support/instagram-scraper/.env
```

### Mensagens de Erro:
```
[Config] ⚠️  No .env file found! Please create one with your Instagram credentials.
```

Se você ver a mensagem de erro, siga os passos da seção "Configuração Inicial" acima.

---

## 🛠️ Desenvolvendo e Fazendo Build

### Desenvolvimento Local
```bash
npm start
```

No modo de desenvolvimento:
- `.env` é lido da raiz do projeto
- `ports/` fica na raiz do projeto
- Tudo funciona como antes

### Build para Distribuição

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

Após o build, a aplicação instalada usará automaticamente:
- `.env` do diretório `userData`
- `ports/` do diretório `userData`

---

## 📊 Acessando Resultados

### Via Interface da Aplicação:
Clique no botão "📂 Open Results Folder" na interface

### Manualmente:
```bash
# macOS
open ~/Library/Application\ Support/instagram-scraper/ports/output/

# Windows
explorer %APPDATA%\instagram-scraper\ports\output\

# Linux
xdg-open ~/.config/instagram-scraper/ports/output/
```

---

## 🔐 Segurança

✅ **Boas Práticas:**
- O arquivo `.env` **NÃO é incluído** no build
- Cada usuário precisa configurar suas próprias credenciais
- Os arquivos ficam no diretório privado do usuário
- Cookies de sessão são salvos localmente

⚠️ **Avisos:**
- **Nunca compartilhe** seu arquivo `.env`
- Mantenha seu `.env` em backup seguro
- Use autenticação de dois fatores no Instagram
- Respeite os limites de rate do Instagram

---

## 🐛 Troubleshooting

### Erro: "INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD must be set"
**Solução:** Crie o arquivo `.env` conforme explicado acima.

### Erro: "No CSV file found"
**Solução:** Use a interface para fazer upload de um arquivo CSV primeiro.

### Erro: "Login failed"
**Possíveis causas:**
1. Credenciais incorretas no `.env`
2. Instagram requer 2FA (desabilite temporariamente ou use senha de app)
3. Conta bloqueada por atividade suspeita

### Aplicação não salva resultados
**Solução:** Verifique as permissões do diretório userData:
```bash
# macOS/Linux
ls -la ~/Library/Application\ Support/instagram-scraper/
```

### Como limpar tudo e começar do zero
```bash
# macOS
rm -rf ~/Library/Application\ Support/instagram-scraper/

# Windows
rmdir /s "%APPDATA%\instagram-scraper"

# Linux
rm -rf ~/.config/instagram-scraper/
```

Depois reabra a aplicação e configure o `.env` novamente.

---

## 📝 Notas de Desenvolvimento

### Por que esta mudança foi necessária?

Quando você faz o build da aplicação Electron, o código é empacotado em um arquivo `.asar` que é **somente leitura**. 

**Antes:**
- A aplicação tentava criar diretórios dentro do `.asar` ❌
- Resultado: `ENOTDIR: not a directory` error

**Agora:**
- A aplicação usa `app.getPath('userData')` ✅
- Diretórios são criados no sistema de arquivos do usuário
- Funciona em desenvolvimento E em produção

### Arquivos modificados:
- `src/paths.js` - Novo módulo de gerenciamento de paths
- `main.js` - Usa `paths.js` para todos os caminhos
- `src/scraper/instagram.js` - Atualizado para usar novos paths
- `src/const.js` - Carrega `.env` do userData em produção

---

## 🎯 Resumo Rápido

1. **Build a aplicação:** `npm run build:mac` (ou win/linux)
2. **Instale a aplicação** no seu sistema
3. **Abra a aplicação pela primeira vez**
4. **Navegue até o diretório de configuração**
   - macOS: `~/Library/Application Support/instagram-scraper/`
   - Windows: `%APPDATA%\instagram-scraper\`
   - Linux: `~/.config/instagram-scraper/`
5. **Edite o arquivo `.env`** com suas credenciais
6. **Reinicie a aplicação**
7. **Pronto!** 🚀

---

**Desenvolvido por:** Guedes, Hugo  
**Versão:** 2.0 (com suporte a produção)
