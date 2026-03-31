<!-- GSD:project-start source:PROJECT.md -->
## Project

**Instagram Scraper Pro — Multi-Projeto**

Dashboard de scraping de Instagram que permite gerenciar múltiplos projetos/clientes. Cada projeto tem seus próprios alvos (targets) e dados de scraping isolados. Construído com Next.js, Puppeteer, e Supabase self-hosted.

**Core Value:** Usuário pode selecionar um projeto e ver/executar scraping apenas dos alvos vinculados àquele projeto, mantendo dados isolados entre clientes.

### Constraints

- **Tech stack**: Manter Next.js + Supabase existente
- **Backward compatibility**: O campo `projeto` é nullable, dados sem projeto devem continuar acessíveis
- **UX**: Seleção de projeto deve ser o primeiro passo, antes de selecionar agente e alvos
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
