

import crypto from 'crypto';
import path from 'path';
import os from 'os';
import { launchBrowser } from './browser';
import { supabase } from './supabase';
import { encrypt, decrypt } from './encryption';
import {
    checkIfPrivate,
    scrollToBottom,
    extractPostsData,
    extractVideoUrl,
    extractCarouselImages
} from './extraction';
import { Protocol } from 'puppeteer-core';

// Types
export interface ScrapeResult {
    username: string;
    status: 'success' | 'failed';
    data?: any;
    error?: string;
    postsFound?: number;
}

const INSTAGRAM_URL = "https://www.instagram.com/";
const LOGIN_URL = "https://www.instagram.com/accounts/login/";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Manual Login Function
export async function performLogin(accountId: string) {
    // verify account exists
    const { data: account, error } = await supabase.from('scrapper_accounts').select('*').eq('id', accountId).single();
    if (error || !account) throw new Error("Account not found");

    // Launch browser (HEADLESS: FALSE) - ONLY WORKS LOCALLY OR WITH BROWSER SERVICE
    console.log("🚀 Launching browser...");
    // Use unique user data dir in /tmp (or os equivalent) to prevent read-only errors on Vercel
    const uniqueUserDataDir = path.join(os.tmpdir(), `userData_${accountId}`);
    const browser = await launchBrowser({ headless: false, userDataDir: uniqueUserDataDir });
    console.log("✅ Browser launched");
    const page = await browser.newPage();
    console.log("📄 New page created");

    try {
        console.log("🌐 Navigating to login URL...");
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log("✅ Navigated to login URL");

        // Autofill if password exists
        if (account.password_encrypted) {
            console.log("🔑 Attempting autofill...");
            try {
                const decryptedPassword = decrypt(account.password_encrypted);
                console.log("⏳ Waiting for username input (60s timeout)...");
                // Wait longer for Vercel cold starts
                await page.waitForSelector('input[name="username"]', { timeout: 60000 });

                // Check for "Allow Cookies" if present (common in Vercel regions)
                try {
                    const cookieBtn = await page.$('button._a9--._ap36._a9_0'); // Common Instagram cookie class
                    if (cookieBtn) {
                        console.log("🍪 Found cookie button, clicking...");
                        await cookieBtn.click();
                        await delay(2000);
                    }
                } catch (e) { }

                console.log("⌨️ Typing username...");
                await page.type('input[name="username"]', account.username, { delay: 50 });
                console.log("⌨️ Typing password...");
                await page.type('input[name="password"]', decryptedPassword, { delay: 50 });

                const loginBtn = await page.$('button[type="submit"]');
                if (loginBtn) {
                    console.log("🖱️ Clicking login button...");
                    await loginBtn.click();
                }
            } catch (err: any) {
                const title = await page.title();
                console.warn(`⚠️ Autofill warning: ${err.message} (Page Title: ${title})`);
            }
        }

        console.log("⏳ Waiting for manual login completion...");
        // Wait for user to log in manually. 
        // We detect login by checking URL change to home or presence of nav elements
        // Timeout 5 minutes.
        await page.waitForFunction(() => {
            return window.location.href === "https://www.instagram.com/" ||
                document.querySelector('a[href="/explore/"]') !== null;
        }, { timeout: 300000 });
        console.log("✅ Login detected!");

        console.log("⏳ Stabilizing session (waiting 5s)...");
        await new Promise(r => setTimeout(r, 5000));

        // Capture cookies
        console.log("🍪 Capturing cookies...");

        // Capture cookies
        const cookies = await page.cookies();

        console.log(`✅ Captured ${cookies.length} cookies`);

        // Encrypt and save
        const cookiesJson = JSON.stringify(cookies);
        const encryptedCookies = encrypt(cookiesJson);

        // Saving as a JSON object with encrypted field to satisfy JSONB column type
        const sessionData = { encrypted: encryptedCookies };

        await supabase.from('scrapper_accounts').update({
            session_cookies: sessionData,
            last_login: new Date().toISOString(),
            is_active: true
        }).eq('id', accountId);

        console.log("💾 Session saved to database");

        // DEBUG: Keep browser open for a bit longer or forever locally?
        // Let's close it but with a longer delay to ensure user sees it
        console.log("👋 Closing browser in 2 seconds...");
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
        return { success: true };

    } catch (e: any) {
        // Screenshot for debug
        try {
            const screenshotPath = path.join(os.tmpdir(), 'debug-login-error.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to ${screenshotPath}`);
        } catch (sErr) {
            console.error("Failed to save screenshot", sErr);
        }

        const pages = await browser.pages();
        if (pages.length > 0) await browser.close();

        throw new Error(`Login failed: ${e.message}`);
    }
}

// Scrape Function
export async function scrapeAccounts(targetUsernames: string[], accountId: string): Promise<ScrapeResult[]> {
    // Get credentials/cookies
    const { data: account } = await supabase.from('scrapper_accounts').select('*').eq('id', accountId).single();
    if (!account || !account.session_cookies) throw new Error("Account not ready (no cookies)");

    // Decrypt cookies
    let cookies: Protocol.Network.CookieParam[] = [];
    try {
        const sessionData = account.session_cookies;
        if (sessionData.encrypted) {
            const decryptedJson = decrypt(sessionData.encrypted);
            cookies = JSON.parse(decryptedJson);
        } else {
            // Fallback for plain json if any
            cookies = sessionData;
        }
    } catch (e) {
        throw new Error("Failed to decrypt session cookies");
    }

    // Launch browser (HEADLESS: TRUE)
    const browser = await launchBrowser({ headless: true });
    const page = await browser.newPage();

    // Set cookies
    if (cookies && cookies.length > 0) {
        // @ts-ignore
        await page.setCookie(...cookies);
    }

    const results: ScrapeResult[] = [];

    for (const username of targetUsernames) {
        try {
            // Update status to scraping
            await supabase.from('users_scrapping').update({ status: 'scraping' }).eq('user', username);

            // Sanitize username (remove @)
            const cleanUsername = username.replace('@', '').trim();
            const targetUrl = INSTAGRAM_URL + cleanUsername;

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Add randomness
            await delay(Math.random() * 2000 + 1000);

            // Check private
            const isPrivate = await checkIfPrivate(page);
            if (isPrivate) {
                await supabase.from('users_scrapping').update({ status: 'failed' }).eq('user', username);
                results.push({ username, status: 'failed', error: 'Private account' });
                continue;
            }

            await scrollToBottom(page, username);
            const posts = await extractPostsData(page, username);

            // Process Reels (extract video URLs)
            const reels = posts.filter(p => p.mediaType === 'reel');
            for (const reel of reels.slice(0, 5)) { // Limit to 5 reels to save time
                const videoData = await extractVideoUrl(page, reel.postUrl);
                if (videoData) {
                    reel.videoUrl = videoData.videoUrl;
                }
            }

            // Process Carousels (extract images)
            const carousels = posts.filter(p => p.isCarousel);
            for (const carousel of carousels.slice(0, 5)) { // Limit to 5 carousels
                const carouselData = await extractCarouselImages(page, carousel.postUrl);
                if (carouselData) {
                    carousel.carouselImages = carouselData.images.map((img: any) => img.url);
                }
            }

            // Save to DB (Prevent duplicates)
            const postsPayload = posts.map(post => ({
                // No ID provided, let Postgres generate it
                username: cleanUsername,
                postid: post.postId,
                posturl: post.postUrl,
                mediatype: post.mediaType,
                alttext: post.altText,
                mediaurl: post.mediaUrl,
                videourl: post.videoUrl || null,
                iscarousel: post.isCarousel,
                carouselimages: post.carouselImages || [],
                updated_at: new Date().toISOString()
            }));

            if (postsPayload.length > 0) {
                console.log(`💾 Saving ${postsPayload.length} posts to database for ${username}...`);
                const { error: insertError, count } = await supabase
                    .from('scrappers_contents')
                    .upsert(postsPayload, {
                        onConflict: 'postid',
                        ignoreDuplicates: true
                    })
                    // @ts-ignore
                    .select('id', { count: 'exact' });

                if (insertError) {
                    // Check for 42P10 specifically
                    if (insertError.code === '42P10') {
                        console.error(`❌ CONSTRAINT MISSING: Please run SQL: ALTER TABLE scrappers_contents ADD CONSTRAINT scrappers_contents_postid_key UNIQUE (postid);`);
                    }
                    console.error(`❌ Error saving posts for ${username}:`, insertError);
                    results.push({ username, status: 'failed', error: `DB Error: ${insertError.message}` });
                } else {
                    console.log(`✅ Saved/Ignored ${postsPayload.length} posts for ${username}. (DB count: ${count})`);
                    results.push({ username, status: 'success', postsFound: postsPayload.length });
                }
            } else {
                const pageTitle = await page.title();
                console.log(`⚠️ No posts found for ${username}. Page Title: "${pageTitle}"`);
                const timestamp = new Date().getTime();
                const screenshotPath = path.join(os.tmpdir(), `debug-noposts-${username}-${timestamp}.png`);
                try {
                    await page.screenshot({ path: screenshotPath });
                    console.log(`📸 Debug Screenshot saved: ${screenshotPath}`);
                } catch (e) { console.error('Screenshot failed', e); }

                results.push({ username, status: 'success', postsFound: 0 }); // Success but 0
            }

            await supabase.from('users_scrapping').update({
                status: 'completed',
                data_ultimo_scrapping: new Date().toISOString()
            }).eq('user', username);

            results.push({ username, status: 'success', data: { posts: posts.length } });

        } catch (e: any) {
            console.error(`Error scraping ${username}: ${e.message}`);
            await supabase.from('users_scrapping').update({ status: 'failed' }).eq('user', username);
            results.push({ username, status: 'failed', error: e.message });
        }
    }

    await browser.close();
    return results;
}
