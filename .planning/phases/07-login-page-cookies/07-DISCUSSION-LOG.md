# Phase 7: Login Page & Cookies - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 07-login-page-cookies
**Areas discussed:** Browser embedding, Account selection, Cookie capture flow

---

## Browser Embedding Approach

### How should the Browserless browser be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| noVNC live viewer | Embed noVNC client for real-time browser interaction via VNC endpoint | ✓ |
| Screenshot polling + click forwarding | Periodic screenshots with mouse/keyboard forwarding | |
| Browserless DevTools viewer | Embed /devtools/ in iframe | |

**User's choice:** noVNC live viewer (Recommended)

---

## Account Selection for Login

### How should user select which account to log in for?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown of existing accounts | Select from scrapper_accounts, pick before starting browser | ✓ |
| Dropdown + create new inline | Same plus inline account creation | |
| Auto-detect from login | Detect username after login, match/create automatically | |

**User's choice:** Dropdown of existing accounts (Recommended)

---

## Cookie Capture Flow

### How should cookies be captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual 'Capturar Cookies' button | User clicks after login complete (including 2FA). Validates sessionid. | ✓ |
| Auto-detect login success | Monitor page for login completion, auto-extract | |
| Both auto + manual fallback | Auto-detect with manual button as fallback | |

**User's choice:** Manual 'Capturar Cookies' button (Recommended)

---

## Claude's Discretion

- noVNC client library and integration
- Puppeteer session lifecycle management
- API route structure for browser session
- Page layout and UX
- Error handling

## Deferred Ideas

None — discussion stayed within phase scope.
