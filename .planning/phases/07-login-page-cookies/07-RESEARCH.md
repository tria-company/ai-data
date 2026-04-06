# Phase 7: Login Page & Cookies - Research

**Researched:** 2026-04-06
**Domain:** Browser embedding via CDP screencast, Puppeteer cookie extraction, Next.js admin UI
**Confidence:** HIGH

## Summary

This phase requires embedding an interactive browser view in a Next.js admin page so users can manually log into Instagram and capture session cookies. The critical discovery is that **Browserless's liveURL/hybrid automation feature is paid-only** and NOT available on the self-hosted Docker image (`ghcr.io/browserless/chromium`). The noVNC approach referenced in the UI-SPEC also won't work because Browserless does not expose a VNC server.

The viable approach for self-hosted Browserless is **CDP screencast** (`Page.startScreencast`) combined with **Socket.io** for real-time frame streaming and input forwarding. This uses standard Chrome DevTools Protocol available on any Puppeteer connection. The server-side Puppeteer session captures screencast frames and forwards them as base64 JPEG images to the React client via WebSocket, while user mouse/keyboard events are relayed back to Puppeteer.

**Primary recommendation:** Build a CDP screencast-based interactive browser viewer using Socket.io for bidirectional communication between the Next.js API (Puppeteer session) and the React client. Extract cookies via `page.cookies()` on user command, then call the existing `POST /api/accounts/import-cookies` endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Use live viewer to display the Browserless browser (originally said noVNC -- adjusted to CDP screencast since VNC unavailable)
- D-02: Page opens a Puppeteer session connected to Browserless (`ws://browserless:3000`) and navigates to Instagram login. Viewer shows browser in real-time
- D-03: Dropdown of existing accounts from `scrapper_accounts` table. No inline account creation
- D-04: After successful cookie capture, account updated with `cookie_valid=true`, `is_active=true`, and encrypted cookies
- D-05: Manual "Capturar Cookies" button. No auto-detection
- D-06: Extract all cookies, validate `sessionid` exists, encrypt, save to Supabase. Clear success/error feedback
- D-07: Existing `POST /api/accounts/import-cookies` already validates sessionid and encrypts -- reuse this API endpoint
- D-08: Browserless container at `ws://browserless:3000` (Phase 4)
- D-09: Cookie encryption via `lib/encryption.ts`
- D-10: `POST /api/accounts/save-session` and `POST /api/accounts/import-cookies` already exist
- D-11: Single `.env` shared by all containers

### Claude's Discretion
- Browser viewer library/integration approach (CDP screencast recommended over noVNC)
- Puppeteer session lifecycle (create on page load vs on-demand)
- API route for starting/stopping the browser session
- Page layout (browser viewer size, account selector placement, button positioning)
- Error handling for Browserless connection failures
- Whether to use a separate API route for cookie extraction or handle client-side

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOGIN-01 | Pagina /admin/login-session exibe browser Browserless embutido apontando para Instagram | CDP screencast architecture with Socket.io provides interactive browser view. See Architecture Patterns section |
| LOGIN-02 | Usuario pode fazer login manualmente no Instagram via browser embutido | Mouse/keyboard event forwarding via Socket.io enables full interaction. See Code Examples section |
| LOGIN-03 | Botao "Capturar Cookies" extrai cookies da sessao, encripta e salva no banco | `page.cookies()` API + existing `POST /api/accounts/import-cookies`. See Cookie Extraction section |
| LOGIN-04 | Conta marcada como cookie_valid=true e is_active=true apos captura | Requires fix to import-cookies route (currently missing `cookie_valid: true`). See Pitfall 3 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer-core | 24.35.0 | Browser automation + CDP screencast | Already in project, provides `Page.startScreencast` via CDP |
| socket.io | 4.8.3 | Real-time bidirectional WebSocket communication | Industry standard for real-time streaming, well-supported in Next.js |
| socket.io-client | 4.8.3 | Client-side WebSocket for React | Pairs with socket.io server |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next (existing) | 16.1.4 | Framework - API routes, pages | Already in project |
| lucide-react (existing) | 0.562.0 | Icons (Loader2, CheckCircle, AlertTriangle) | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CDP screencast + Socket.io | Browserless liveURL | liveURL is paid-only, NOT available on self-hosted Docker |
| CDP screencast + Socket.io | noVNC (react-vnc) | Browserless does NOT expose a VNC server; noVNC requires VNC protocol |
| Socket.io | Server-Sent Events | SSE is unidirectional; we need bidirectional for mouse/keyboard input forwarding |
| Socket.io | WebSocket API (native) | Socket.io adds reconnection, fallback, rooms -- worth the minimal overhead |

**Installation:**
```bash
npm install socket.io socket.io-client
```

## Architecture Patterns

### Recommended Project Structure
```
app/
  admin/
    login-session/
      page.tsx          # Client component ('use client') - main login page
  api/
    browser-session/
      route.ts          # NOT used for Socket.io -- see note below
lib/
  browser-session.ts    # Puppeteer session manager (create, cookies, destroy)
server/
  socket-server.ts      # Socket.io server setup (attached to Next.js HTTP server)
```

### Pattern 1: CDP Screencast Architecture
**What:** Server-side Puppeteer captures screencast frames via CDP, streams them to the client via Socket.io. Client renders frames as images and forwards user input events back.
**When to use:** When you need an interactive browser view without VNC or paid services.

**Flow:**
```
React Client                    Socket.io Server              Puppeteer/Browserless
    |                                |                              |
    |-- "start-session" ----------->|                              |
    |                                |-- puppeteer.connect() ----->|
    |                                |-- page.goto(instagram) ---->|
    |                                |-- CDP startScreencast ----->|
    |                                |                              |
    |<-- "screencast-frame" --------|<-- CDP screencastFrame ------|
    |   (base64 JPEG)               |                              |
    |                                |                              |
    |-- "mouse-click" {x,y} ------->|-- page.mouse.click(x,y) --->|
    |-- "mouse-move" {x,y} -------->|-- page.mouse.move(x,y) ---->|
    |-- "key-press" {key} --------->|-- page.keyboard.press(key)->|
    |-- "key-type" {text} --------->|-- page.keyboard.type(text)->|
    |                                |                              |
    |-- "capture-cookies" --------->|-- page.cookies() ---------->|
    |<-- "cookies-captured" --------|   (returns cookie array)     |
    |                                |                              |
    |-- "stop-session" ------------>|-- browser.disconnect() ---->|
```

### Pattern 2: Socket.io in Next.js (Custom Server or API Route)
**What:** Socket.io requires attaching to an HTTP server. In Next.js, this is done via a custom server or by attaching to the underlying HTTP server in an API route on first request.
**When to use:** When Next.js needs real-time WebSocket communication.

**Approach for this project (Docker/standalone mode):**
Since the project uses `output: 'standalone'` with Docker, a custom `server.ts` is the cleanest approach. However, the simpler approach is to attach Socket.io to the Next.js HTTP server inside an API route handler that acts as a setup endpoint.

**Simpler approach -- API route that initializes Socket.io:**
```typescript
// app/api/socket/route.ts
import { NextResponse } from 'next/server';
import { initSocketServer } from '@/server/socket-server';

export async function GET(req: Request) {
  // @ts-ignore - access underlying HTTP server
  const server = (req as any).socket?.server;
  if (server && !server.io) {
    initSocketServer(server);
  }
  return NextResponse.json({ ok: true });
}
```

**Note:** In Next.js standalone mode with Docker, the HTTP server is accessible. The Socket.io server attaches once and stays alive.

### Pattern 3: Puppeteer Session Lifecycle
**What:** Manage a single Puppeteer browser session per login flow.
**When to use:** For the login session page.

```
1. User selects account + page loads
2. Client emits "start-session"
3. Server: puppeteer.connect({ browserWSEndpoint: 'ws://browserless:3000' })
4. Server: page = await browser.newPage()
5. Server: await page.goto('https://www.instagram.com/accounts/login/')
6. Server: start CDP screencast
7. User interacts via screencast
8. User clicks "Capturar Cookies"
9. Server: const cookies = await page.cookies('https://www.instagram.com')
10. Server: POST to /api/accounts/import-cookies with { accountId, cookies }
11. Server: browser.disconnect()
```

### Anti-Patterns to Avoid
- **Launching a new browser per frame:** Use a single persistent Puppeteer connection for the entire login session
- **Using REST API for screencast:** REST is request-response; screencast needs streaming -- use Socket.io
- **Exposing Puppeteer directly to the client:** All browser interaction must go through Socket.io server; never expose browserWSEndpoint to frontend
- **Trying noVNC with Browserless:** Browserless is NOT a VNC server; it uses CDP
- **Assuming liveURL works on self-hosted:** `Browserless.liveURL` CDP command is enterprise/paid only

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie encryption | Custom crypto | `lib/encryption.ts` (existing) | Already tested and in use by workers |
| Cookie validation | Manual cookie parsing | `POST /api/accounts/import-cookies` (existing) | Already validates sessionid, encrypts, saves |
| WebSocket communication | Raw WebSocket API | socket.io + socket.io-client | Handles reconnection, room management, fallbacks |
| Screencast frame capture | Custom screenshot loop | CDP `Page.startScreencast` | Chrome-native, async, efficient -- does not block rendering |
| Account listing | New query | `GET /api/accounts/list` (existing) | Already queries scrapper_accounts |

**Key insight:** The CDP screencast API (`Page.startScreencast`) is built into Chrome and far more efficient than calling `page.screenshot()` in a loop. It streams frames asynchronously without blocking the page.

## Common Pitfalls

### Pitfall 1: Coordinate Scaling Between Client and Puppeteer Viewport
**What goes wrong:** User clicks on the screencast image but the click registers at the wrong position because the displayed image size differs from the Puppeteer viewport size.
**Why it happens:** The screencast frame is rendered at the Puppeteer viewport resolution (e.g., 1920x1080) but displayed at a different size in the browser.
**How to avoid:** Calculate a scale factor: `scaleX = viewportWidth / displayedImageWidth`. Apply the scale to all mouse coordinates before forwarding to Puppeteer.
**Warning signs:** Clicks consistently miss their targets, especially near edges.

### Pitfall 2: Browserless CONCURRENT Limit
**What goes wrong:** Starting a browser session fails because Browserless already has the maximum number of concurrent sessions (currently set to 2 in docker-compose.yml).
**Why it happens:** Workers may be using both available browser slots.
**How to avoid:** Either increase CONCURRENT in docker-compose, or add error handling that tells the user to wait. Consider a dedicated Browserless instance for login sessions.
**Warning signs:** WebSocket connection to Browserless times out or is rejected.

### Pitfall 3: import-cookies Route Missing cookie_valid Update
**What goes wrong:** After capturing cookies, the account is NOT marked as `cookie_valid=true` -- only `is_active: true` and `last_login` are set. Workers won't pick up the account because they query `WHERE cookie_valid = true AND is_active = true`.
**Why it happens:** The existing `POST /api/accounts/import-cookies` route was written before the worker system that depends on `cookie_valid`.
**How to avoid:** Add `cookie_valid: true` to the Supabase update in `import-cookies/route.ts`.
**Warning signs:** Cookie capture succeeds but account still shows as invalid in the system.

### Pitfall 4: Socket.io Port/Path Conflicts in Docker
**What goes wrong:** Socket.io WebSocket connection fails because the port or path conflicts with the Next.js dev server or Docker networking.
**Why it happens:** Socket.io needs to be on the same port as the Next.js server (3000) to avoid CORS and Docker port mapping issues.
**How to avoid:** Attach Socket.io to the same HTTP server that Next.js uses. Use a custom path like `/api/socket/io` to avoid conflicts with Next.js routes.
**Warning signs:** WebSocket connection errors in browser console, CORS errors.

### Pitfall 5: Browserless Session Timeout
**What goes wrong:** The Puppeteer session disconnects mid-login because Browserless has a 120-second timeout (set via TIMEOUT=120000 in docker-compose).
**Why it happens:** Instagram login with 2FA can take longer than 2 minutes if the user is slow.
**How to avoid:** Increase `TIMEOUT` in docker-compose.yml for the login use case (e.g., 600000 = 10 minutes). Alternatively, send periodic CDP commands to keep the session alive.
**Warning signs:** Browser session suddenly disconnects during login.

### Pitfall 6: accounts/list API Missing cookie_valid Field
**What goes wrong:** Account dropdown cannot show cookie validity status because the API only returns `id, username, last_login, is_active`.
**Why it happens:** The API was written for a different use case that didn't need cookie_valid.
**How to avoid:** Add `cookie_valid` to the select clause in `GET /api/accounts/list`, or modify the query for the login page to also select `cookie_valid`. Also consider removing the `.eq('is_active', true)` filter so inactive accounts (that need re-login) also appear.
**Warning signs:** Account selector cannot show which accounts need cookie refresh.

## Code Examples

### CDP Screencast Setup (Server-Side)
```typescript
// Source: Chrome DevTools Protocol + Novu blog reference
import puppeteer from 'puppeteer-core';

async function startScreencast(page: puppeteer.Page, onFrame: (data: string) => void) {
  const cdp = await page.createCDPSession();

  cdp.on('Page.screencastFrame', async (frameObject) => {
    // frameObject.data is base64-encoded JPEG
    onFrame(frameObject.data);

    // MUST acknowledge frame receipt or stream stops
    await cdp.send('Page.screencastFrameAck', {
      sessionId: frameObject.sessionId,
    });
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 60,        // Balance quality vs bandwidth (10-100)
    maxWidth: 1280,      // Match desired display size
    maxHeight: 800,
    everyNthFrame: 1,    // Every frame
  });

  return cdp; // Return to stop later with Page.stopScreencast
}
```

### Mouse/Keyboard Event Forwarding (Socket.io)
```typescript
// Server-side: handle client input events
socket.on('mouse-click', async ({ x, y }) => {
  if (!page) return;
  await page.mouse.click(x, y);
});

socket.on('mouse-move', async ({ x, y }) => {
  if (!page) return;
  await page.mouse.move(x, y);
});

socket.on('key-press', async ({ key }) => {
  if (!page) return;
  await page.keyboard.press(key as puppeteer.KeyInput);
});

socket.on('key-type', async ({ text }) => {
  if (!page) return;
  await page.keyboard.type(text);
});

socket.on('scroll', async ({ deltaX, deltaY }) => {
  if (!page) return;
  await page.mouse.wheel({ deltaX, deltaY });
});
```

### Client-Side Screencast Display (React)
```typescript
// Source: Novu interactive screen-sharing architecture
'use client';
import { useRef, useCallback } from 'react';

function BrowserViewer({ socket, viewportWidth, viewportHeight }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Receive frames
  useEffect(() => {
    socket.on('screencast-frame', (base64Data: string) => {
      if (imgRef.current) {
        imgRef.current.src = `data:image/jpeg;base64,${base64Data}`;
      }
    });
  }, [socket]);

  // Forward clicks with coordinate scaling
  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = viewportWidth / rect.width;
    const scaleY = viewportHeight / rect.height;
    socket.emit('mouse-click', {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  }, [socket, viewportWidth, viewportHeight]);

  return (
    <div ref={containerRef} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <img ref={imgRef} style={{ width: '100%', height: 'auto' }} />
    </div>
  );
}
```

### Cookie Extraction
```typescript
// Source: Puppeteer docs (pptr.dev/api/puppeteer.page.cookies)
async function extractCookies(page: puppeteer.Page): Promise<any[]> {
  // Get cookies for Instagram domain specifically
  const cookies = await page.cookies('https://www.instagram.com');
  return cookies;
  // Returns array of: { name, value, domain, path, expires, httpOnly, secure, ... }
}
```

### Fix for import-cookies Route (Required)
```typescript
// In app/api/accounts/import-cookies/route.ts
// Current update is missing cookie_valid: true
const { error } = await supabase.from('scrapper_accounts').update({
  session_cookies: sessionData,
  last_login: new Date().toISOString(),
  is_active: true,
  cookie_valid: true,  // ADD THIS -- required for workers to pick up the account
}).eq('id', accountId);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| noVNC + VNC server | CDP screencast + Socket.io | N/A (noVNC never worked with Browserless) | noVNC requires a VNC server; Browserless uses CDP only |
| Browserless liveURL | CDP screencast (self-hosted) | liveURL always paid-only | Self-hosted users must use CDP directly |
| `page.cookies()` (deprecated) | `browserContext.cookies()` | Puppeteer recent versions | `page.cookies(url)` still works but browserContext-level is preferred |
| Custom screenshot loop | `Page.startScreencast` CDP | Always available in CDP | startScreencast is async and does not block page rendering |

**UI-SPEC Note:** The UI-SPEC references "noVNC" but this is not technically accurate. The implementation should use CDP screencast. The visual design (dark container, status badges, viewer area) from the UI-SPEC remains valid -- only the underlying technology changes from noVNC canvas to an `<img>` tag receiving screencast frames.

## Open Questions

1. **Socket.io attachment in Next.js 16 standalone mode**
   - What we know: Socket.io can attach to Node HTTP servers. Next.js standalone creates a server.js entry point
   - What's unclear: The exact mechanism to access the underlying HTTP server in Next.js 16 standalone output. May need a custom server wrapper
   - Recommendation: Test by accessing `globalThis` or modifying the standalone server.js, or use a separate Express server on a different port (e.g., 3001) if attachment fails

2. **Screencast performance over Docker networking**
   - What we know: CDP screencast sends JPEG frames; quality=60 should be ~20-50KB per frame
   - What's unclear: Latency between Browserless container and app container over Docker bridge network
   - Recommendation: Start with quality=60, everyNthFrame=1; reduce if performance is poor

3. **Keyboard input handling for special characters and 2FA codes**
   - What we know: `page.keyboard.type()` handles regular text; `page.keyboard.press()` handles special keys
   - What's unclear: How well this handles international characters, paste operations, and autocomplete
   - Recommendation: Support both `type` (for text) and `press` (for Enter, Tab, Backspace) events. Consider also forwarding `keydown`/`keyup` for modifier keys

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browserless (Docker) | Browser embedding | Configured in docker-compose.yml | ghcr.io/browserless/chromium:latest | No fallback -- required |
| puppeteer-core | CDP screencast + cookies | Installed | 24.35.0 | -- |
| Node.js | Socket.io server | Installed (via Docker) | -- | -- |
| socket.io | Real-time communication | Not installed | 4.8.3 (latest) | -- |
| socket.io-client | Client WebSocket | Not installed | 4.8.3 (latest) | -- |

**Missing dependencies with no fallback:**
- socket.io and socket.io-client need to be installed via npm

**Missing dependencies with fallback:**
- None

## Sources

### Primary (HIGH confidence)
- Puppeteer `page.cookies()` API: https://pptr.dev/api/puppeteer.page.cookies
- Puppeteer cookies guide: https://pptr.dev/guides/cookies
- Chrome DevTools Protocol `Page.startScreencast`: built into Chrome, used via `page.createCDPSession()`
- Browserless open-source deployment docs: https://docs.browserless.io/enterprise/open-source
- Browserless liveURL is paid-only: https://github.com/browserless/browserless/issues/4353

### Secondary (MEDIUM confidence)
- Interactive screen-sharing with Puppeteer + React (Novu): https://novu.co/blog/building-an-interactive-screen-sharing-app-with-puppeteer-and-react -- verified architecture pattern
- Browserless hybrid automation docs (paid feature): https://docs.browserless.io/baas/interactive-browser-sessions/hybrid-automation
- Browserless session watching: https://docs.browserless.io/enterprise/watching-sessions
- react-vnc npm (NOT recommended): https://www.npmjs.com/package/react-vnc -- requires VNC server

### Tertiary (LOW confidence)
- Socket.io integration with Next.js standalone mode -- needs empirical validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - puppeteer-core already in project, socket.io is well-established
- Architecture: HIGH - CDP screencast is a documented Chrome feature, Novu article provides proven React integration pattern
- Pitfalls: HIGH - verified that liveURL is paid-only (GitHub issue), verified import-cookies missing cookie_valid (code inspection), verified accounts/list missing cookie_valid (code inspection)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable technologies, 30-day window)
