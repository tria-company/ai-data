import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import { launchBrowser } from '@/lib/browser';
import { Protocol } from 'puppeteer-core';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');

    if (!accountId) {
        return NextResponse.json({ valid: false, reason: "Missing accountId" }, { status: 400 });
    }

    // 1. Get cookies from DB
    const { data: account, error } = await supabase.from('scrapper_accounts').select('*').eq('id', accountId).single();

    if (error || !account || !account.session_cookies) {
        return NextResponse.json({ valid: false, reason: "Account not found or no cookies" }, { status: 404 });
    }

    let cookies: Protocol.Network.CookieParam[] = [];
    try {
        const sessionData = account.session_cookies;
        if (sessionData.encrypted) {
            const decryptedJson = decrypt(sessionData.encrypted);
            cookies = JSON.parse(decryptedJson);
        } else {
            cookies = sessionData;
        }
    } catch (e) {
        return NextResponse.json({ valid: false, reason: "Failed to decrypt cookies" }, { status: 500 });
    }

    // 2. Launch Browser (Headless)
    let browser;
    try {
        console.log("🚀 Launching browser for validation...");
        browser = await launchBrowser({ headless: true });
        const page = await browser.newPage();

        // 3. Set Cookies (sanitize for Puppeteer compatibility)
        if (cookies.length > 0) {
            const sanitized = cookies.map((c: any) => {
                const clean: any = {
                    name: c.name,
                    value: c.value,
                    domain: c.domain,
                    path: c.path || '/',
                };
                if (c.expires || c.expirationDate) {
                    clean.expires = c.expires || c.expirationDate;
                }
                if (c.httpOnly !== undefined) clean.httpOnly = c.httpOnly;
                if (c.secure !== undefined) clean.secure = c.secure;
                if (c.sameSite && typeof c.sameSite === 'string') {
                    const val = c.sameSite.charAt(0).toUpperCase() + c.sameSite.slice(1).toLowerCase();
                    if (['Strict', 'Lax', 'None'].includes(val)) {
                        clean.sameSite = val;
                    }
                }
                return clean;
            });
            await page.setCookie(...sanitized);
        }

        // 4. Navigate to Instagram
        console.log("🌐 Navigating to Instagram...");
        await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Add a small delay for redirects
        await new Promise(r => setTimeout(r, 2000));

        const url = page.url();
        console.log(`📍 Current URL: ${url}`);

        // 5. Validation Logic
        let isValid = false;
        let reason = "";

        if (url.includes("/accounts/login")) {
            isValid = false;
            reason = "Redirected to login page (Session Expired)";
        } else if (url === "https://www.instagram.com/" || url.includes("/explore")) {
            isValid = true;
        } else {
            // Check for specific element indicating login
            try {
                // Look for 'Search' or 'Home' or 'Profile' icons which are SVGs with specific aria-labels often,
                // or just verify we are NOT on login.
                // A good check is presence of specific UI elements like the left sidebar nav
                // <nav> usually exists on logged in desktop view
                const nav = await page.$('nav');
                if (nav) {
                    isValid = true;
                } else {
                    isValid = false;
                    reason = "Unrecognized page state";
                }
            } catch (e) {
                isValid = false;
                reason = "Error checking page state";
            }
        }

        await browser.close();

        return NextResponse.json({ valid: isValid, reason: isValid ? "Session Active" : reason });

    } catch (e: any) {
        console.error("Validation error:", e);
        if (browser) await browser.close();
        return NextResponse.json({ valid: false, reason: `Runtime error: ${e.message}` }, { status: 500 });
    }
}
