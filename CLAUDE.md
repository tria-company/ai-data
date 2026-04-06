<!-- GSD:project-start source:PROJECT.md -->
## Project

**Instagram Scraper Pro**

Plataforma de scraping de Instagram com gerenciamento de múltiplos projetos/clientes. Cada projeto tem alvos isolados. Sistema assíncrono com filas de processamento, workers dedicados, e infraestrutura Docker auto-hospedada. Construído com Next.js, Puppeteer, BullMQ, Redis, e Supabase self-hosted.

**Core Value:** Scraping confiável e escalável via API assíncrona — requisições são enfileiradas e processadas por workers dedicados, com seleção automática de conta e notificação quando intervenção humana é necessária.

### Constraints

- **Tech stack**: Manter Next.js + Supabase existente, adicionar BullMQ + Redis + Browserless
- **Deploy**: Docker Compose em VPS (Hetzner/DigitalOcean, ~$5-15/mês)
- **Instagram rate limits**: Max ~100 requests/hora por conta, necessário round-robin
- **Backward compatibility**: Frontend existente deve continuar funcionando durante migração
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
