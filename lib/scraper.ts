

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
    extractCarouselImages,
    extractPostLikes,
    extractPostComments
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

// Manual Login Function - DEPRECATED / REMOVED
// We now rely on 'import-cookies' API to set up the session.
// This function is removed to prevent accidental usage of headless: false logic.
export async function performLogin(accountId: string) {
    throw new Error("Manual login is no longer supported on Vercel. Please use Cookie Import.");
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

            // Extract likes and comments for posts (limit to 10 to avoid timeouts)
            const postsForEngagement = posts.slice(0, 10);
            let totalLikes = 0;
            let totalComments = 0;

            for (const post of postsForEngagement) {
                try {
                    const likes = await extractPostLikes(page, post.postUrl);
                    post.likes = likes;
                    totalLikes += likes.length;
                } catch (e: any) {
                    console.warn(`[likes] Failed for ${post.postUrl}: ${e.message}`);
                    post.likes = [];
                }

                try {
                    const comments = await extractPostComments(page, post.postUrl);
                    post.comments = comments;
                    totalComments += comments.length;
                } catch (e: any) {
                    console.warn(`[comments] Failed for ${post.postUrl}: ${e.message}`);
                    post.comments = [];
                }

                // Random delay between posts to avoid rate limiting
                await delay(Math.random() * 1000 + 500);
            }

            console.log(`Extracted ${totalLikes} likes and ${totalComments} comments for ${username}`);

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

            // Save likes to DB
            const likesPayload: Array<{postid: string, liker_username: string}> = [];
            for (const post of posts) {
                if (post.likes && post.likes.length > 0) {
                    for (const liker of post.likes) {
                        likesPayload.push({ postid: post.postId, liker_username: liker });
                    }
                }
            }

            if (likesPayload.length > 0) {
                const { error: likesError } = await supabase
                    .from('post_likes')
                    .upsert(likesPayload, {
                        onConflict: 'postid,liker_username',
                        ignoreDuplicates: true
                    });

                if (likesError) {
                    console.error(`Error saving likes for ${username}:`, likesError);
                } else {
                    console.log(`Saved ${likesPayload.length} likes for ${username}`);
                }
            }

            // Save comments to DB
            const commentsPayload: Array<{postid: string, commenter_username: string, comment_text: string}> = [];
            for (const post of posts) {
                if (post.comments && post.comments.length > 0) {
                    for (const comment of post.comments) {
                        commentsPayload.push({
                            postid: post.postId,
                            commenter_username: comment.username,
                            comment_text: comment.text
                        });
                    }
                }
            }

            if (commentsPayload.length > 0) {
                const { error: commentsError } = await supabase
                    .from('post_comments')
                    .upsert(commentsPayload, {
                        onConflict: 'postid,commenter_username,comment_text',
                        ignoreDuplicates: true
                    });

                if (commentsError) {
                    console.error(`Error saving comments for ${username}:`, commentsError);
                } else {
                    console.log(`Saved ${commentsPayload.length} comments for ${username}`);
                }
            }

            await supabase.from('users_scrapping').update({
                status: 'completed',
                data_ultimo_scrapping: new Date().toISOString()
            }).eq('user', username);

            results.push({ username, status: 'success', data: { posts: posts.length, likes: totalLikes, comments: totalComments } });

        } catch (e: any) {
            console.error(`Error scraping ${username}: ${e.message}`);
            await supabase.from('users_scrapping').update({ status: 'failed' }).eq('user', username);
            results.push({ username, status: 'failed', error: e.message });
        }
    }

    await browser.close();
    return results;
}
