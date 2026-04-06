---
phase: 07-login-page-cookies
plan: 01
subsystem: infra
tags: [socket.io, puppeteer, cdp, browserless, websocket, cookies]

# Dependency graph
requires:
  - phase: 04-docker-infra
    provides: Browserless container at ws://browserless:3000 and docker-compose.yml

provides:
  - Socket.io server attached to Next.js HTTP server via /api/socket/io path
  - CDP screencast browser session lifecycle (create, stream, input, cookies, destroy)
  - lib/browser-session.ts - Puppeteer session manager with Page.startScreencast
  - server/socket-server.ts - Socket.io event handlers for browser control
  - app/api/socket/route.ts - Socket.io bootstrap endpoint
  - Fixed import-cookies API: sets cookie_valid=true alongside is_active=true
  - Fixed accounts/list API: returns cookie_valid field and shows all accounts (no is_active filter)
  - Browserless TIMEOUT extended to 600000ms (10 minutes) for manual login with 2FA

affects:
  - 07-02 (login page frontend - depends on all server infrastructure built here)

# Tech tracking
tech-stack:
  added: [socket.io 4.8.3, socket.io-client 4.8.3]
  patterns:
    - CDP screencast via Page.startScreencast with screencastFrameAck acknowledgment
    - Socket.io attached to Next.js HTTP server via API route bootstrap pattern
    - BrowserSession encapsulates (browser, page, cdp) for clean lifecycle management

key-files:
  created:
    - lib/browser-session.ts
    - server/socket-server.ts
    - app/api/socket/route.ts
  modified:
    - app/api/accounts/import-cookies/route.ts
    - app/api/accounts/list/route.ts
    - docker-compose.yml
    - package.json

key-decisions:
  - "Socket.io path set to /api/socket/io to avoid conflict with Next.js route /api/socket"
  - "CDP screencast quality=60 jpeg at 1280x800 viewport balances frame size and quality"
  - "Session cleanup on disconnect is fire-and-forget (try/catch swallowed) to prevent double-cleanup errors"

patterns-established:
  - "Pattern: Socket.io bootstrap via GET /api/socket route attaching to req.socket.server"
  - "Pattern: BrowserSession struct groups (browser, page, cdp) for unified lifecycle"
  - "Pattern: Screencast FrameAck must be sent immediately per frame or stream stalls"

requirements-completed: [LOGIN-01, LOGIN-02, LOGIN-03, LOGIN-04]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 07 Plan 01: Login Page & Cookies Backend Summary

**CDP screencast browser session manager with Socket.io server streaming Puppeteer frames, forwarding input events, and extracting Instagram cookies via existing import-cookies API**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T23:12:55Z
- **Completed:** 2026-04-06T23:14:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed socket.io and socket.io-client v4.8.3; wired Socket.io server to Next.js HTTP via API route bootstrap
- Built CDP screencast lifecycle in lib/browser-session.ts: connects to Browserless, navigates to Instagram login, streams JPEG frames at 1280x800, forwards mouse/keyboard/scroll events, extracts cookies on demand, cleans up on disconnect
- Fixed two pre-existing API bugs: import-cookies now sets cookie_valid=true; accounts/list now returns cookie_valid field and shows all accounts (not just active ones)
- Extended Browserless timeout from 2 minutes to 10 minutes to accommodate manual Instagram login with 2FA

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Socket.io, fix existing APIs, update Browserless timeout** - `030398e` (feat)
2. **Task 2: Create browser session manager and Socket.io server** - `4b0435c` (feat)

**Plan metadata:** (to be set after final commit)

## Files Created/Modified

- `lib/browser-session.ts` - Puppeteer session lifecycle: createSession (connect, navigate, startScreencast), extractCookies (page.cookies), destroySession (stopScreencast, disconnect)
- `server/socket-server.ts` - Socket.io server with handlers: start-session, mouse-click, mouse-move, key-press, key-type, scroll, capture-cookies, stop-session, disconnect
- `app/api/socket/route.ts` - GET handler that bootstraps Socket.io by attaching to req.socket.server on first request
- `app/api/accounts/import-cookies/route.ts` - Added cookie_valid: true to Supabase update
- `app/api/accounts/list/route.ts` - Added cookie_valid to select, removed .eq('is_active', true) filter
- `docker-compose.yml` - Browserless TIMEOUT changed from 120000 to 600000
- `package.json` / `package-lock.json` - socket.io and socket.io-client added

## Decisions Made

- Socket.io path set to `/api/socket/io` to avoid conflict with Next.js route `/api/socket` — both coexist because the route handler and Socket.io use different protocol paths
- CDP screencast quality=60 JPEG at 1280x800 chosen per research recommendations to balance frame size (~20-50KB) and visual quality
- Session cleanup on disconnect uses silent try/catch to prevent double-cleanup errors if browser already disconnected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors from bullmq, express, and @bull-board packages not installed in local dev (they run in Docker). These are unrelated to this plan's changes and were not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All server-side infrastructure is in place for the login page frontend (plan 07-02)
- Frontend needs to: connect via socket.io-client to `/api/socket/io`, render CDP frames as `<img>` tags, forward mouse/keyboard events with coordinate scaling, and call `capture-cookies` then POST to import-cookies
- One open question: Socket.io attachment via `req.socket?.server` may not work in Next.js 16 standalone mode — if it fails, a custom server wrapper may be needed (documented in RESEARCH.md as open question)

---
*Phase: 07-login-page-cookies*
*Completed: 2026-04-06*

## Self-Check: PASSED

- lib/browser-session.ts: FOUND
- server/socket-server.ts: FOUND
- app/api/socket/route.ts: FOUND
- 07-01-SUMMARY.md: FOUND
- Commit 030398e (Task 1): FOUND
- Commit 4b0435c (Task 2): FOUND
