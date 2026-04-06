import puppeteer, { type Browser, type Page, type CDPSession } from 'puppeteer-core';

// Viewport dimensions for screencast (must match client-side scaling)
export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 800;

export interface BrowserSession {
  browser: Browser;
  page: Page;
  cdp: CDPSession;
}

/**
 * Creates a new Puppeteer session connected to Browserless,
 * navigates to Instagram login, and starts CDP screencast.
 */
export async function createSession(
  onFrame: (base64Data: string) => void
): Promise<BrowserSession> {
  const wsEndpoint = process.env.BROWSERLESS_WS_ENDPOINT || 'ws://browserless:3000';
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  const page = await browser.newPage();
  await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  const cdp = await page.createCDPSession();

  cdp.on('Page.screencastFrame', async (frameObject: any) => {
    onFrame(frameObject.data);
    await cdp.send('Page.screencastFrameAck', {
      sessionId: frameObject.sessionId,
    });
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 60,
    maxWidth: VIEWPORT_WIDTH,
    maxHeight: VIEWPORT_HEIGHT,
    everyNthFrame: 1,
  });

  return { browser, page, cdp };
}

/**
 * Extracts all cookies for instagram.com from the session.
 */
export async function extractCookies(page: Page): Promise<any[]> {
  return await page.cookies('https://www.instagram.com');
}

/**
 * Stops screencast and disconnects the browser session.
 */
export async function destroySession(session: BrowserSession): Promise<void> {
  try {
    await session.cdp.send('Page.stopScreencast');
  } catch {}
  try {
    session.browser.disconnect();
  } catch {}
}
