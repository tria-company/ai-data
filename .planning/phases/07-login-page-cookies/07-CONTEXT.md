# Phase 7: Login Page & Cookies - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin page at `/admin/login-session` that displays a Browserless-powered browser via noVNC for manual Instagram login. User selects an existing account from a dropdown, completes login in the embedded browser (including 2FA if needed), then clicks "Capturar Cookies" to extract, encrypt, and save session cookies. The account is marked as `cookie_valid=true` and `is_active=true`.

</domain>

<decisions>
## Implementation Decisions

### Browser Embedding
- **D-01:** Use noVNC live viewer to display the Browserless browser. Browserless exposes a VNC endpoint — embed a noVNC client in the page for real-time mouse/keyboard interaction with the browser. User sees and controls a real Chromium instance.
- **D-02:** The page opens a Puppeteer session connected to Browserless (`ws://browserless:3000`) and navigates to `https://www.instagram.com/accounts/login/`. The VNC stream shows the browser in real-time.

### Account Selection
- **D-03:** Dropdown of existing accounts from `scrapper_accounts` table. User picks which account to log in for before starting the browser session. No inline account creation — use existing account management.
- **D-04:** After successful cookie capture, the selected account is updated with `cookie_valid=true`, `is_active=true`, and encrypted cookies.

### Cookie Capture Flow
- **D-05:** Manual "Capturar Cookies" button. User clicks after completing Instagram login (including 2FA if needed). No auto-detection.
- **D-06:** On button click: extract all cookies from the Puppeteer browser context, validate that `sessionid` cookie exists, encrypt cookies via `lib/encryption.ts`, save to `scrapper_accounts` via Supabase. Show clear success/error feedback.
- **D-07:** Existing `POST /api/accounts/import-cookies` already validates `sessionid` and encrypts — reuse this API endpoint from the frontend.

### Prior Decisions (from Phases 4-6)
- **D-08:** Browserless container available at `ws://browserless:3000` (Phase 4)
- **D-09:** Cookie encryption via `lib/encryption.ts` with `encrypt()`/`decrypt()` functions
- **D-10:** `POST /api/accounts/save-session` and `POST /api/accounts/import-cookies` already exist for cookie persistence
- **D-11:** Single `.env` shared by all containers

### Claude's Discretion
- noVNC client library choice and integration approach
- How to manage the Puppeteer session lifecycle (create on page load vs on-demand)
- API route for starting/stopping the browser session
- Page layout (browser viewer size, account selector placement, button positioning)
- Error handling for Browserless connection failures
- Whether to use a separate API route for cookie extraction or handle client-side

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Account & Cookie APIs
- `app/api/accounts/import-cookies/route.ts` — Cookie import with sessionid validation and encryption (REUSE)
- `app/api/accounts/save-session/route.ts` — Session save with encryption
- `app/api/accounts/list/route.ts` — Account listing for dropdown
- `app/api/accounts/validate-session/route.ts` — Session validation

### Shared Libraries
- `lib/encryption.ts` — Cookie encryption/decryption
- `lib/browser.ts` — Browser connection abstraction (getBrowser with Browserless WebSocket)
- `lib/supabase.ts` — Supabase client (lazy Proxy pattern)

### Infrastructure (Phase 4)
- `docker-compose.yml` — Browserless service definition
- `.env` — BROWSERLESS_WS_ENDPOINT=ws://browserless:3000

### Database Schema
- `supabase_schema.sql` — scrapper_accounts table (session_cookies, cookie_valid, is_active, last_login)

### Planning
- `.planning/REQUIREMENTS.md` — LOGIN-01, LOGIN-02, LOGIN-03, LOGIN-04
- `.planning/ROADMAP.md` — Phase 7 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `POST /api/accounts/import-cookies` — Already validates sessionid, encrypts, and saves cookies. Can be called from the login page after extraction.
- `GET /api/accounts/list` — Already returns all accounts for dropdown population.
- `getBrowser()` in `lib/browser.ts` — Connects to Browserless via WebSocket. May need adaptation for VNC session management.
- `encrypt()` in `lib/encryption.ts` — Cookie encryption, used by existing APIs.

### Established Patterns
- Admin pages at `app/admin/` (e.g., `app/admin/queues/page.tsx`)
- API routes use `NextResponse.json()` pattern
- Supabase queries via `supabase.from('table').update/select`

### Integration Points
- New page at `app/admin/login-session/page.tsx` (client component with 'use client')
- API route for managing Puppeteer/browser session (start, extract cookies, stop)
- noVNC viewer embedded as React component
- Account selector fetches from existing `/api/accounts/list`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for noVNC integration and Puppeteer session management.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-login-page-cookies*
*Context gathered: 2026-04-06*
