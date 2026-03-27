
import { Page } from 'puppeteer-core';

// Helper for delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkIfPrivate(page: Page): Promise<boolean> {
    try {
        await delay(1500);

        const result = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            // Indicadores de conta privada
            const privateIndicators = [
                "essa conta é privada",
                "this account is private",
                "siga esse usuário",
                "follow this account",
            ];

            const isPrivate = privateIndicators.some((indicator) =>
                text.includes(indicator)
            );

            const hasPosts =
                document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length > 0;

            return {
                isPrivate: isPrivate && !hasPosts,
            };
        });

        return result.isPrivate;
    } catch (err) {
        console.error("Error checking privacy:", err);
        return false;
    }
}

export async function extractFollowers(page: Page, username: string): Promise<string | null> {
    const followers = await page.evaluate(() => {
        const followersLink = document.querySelector("a[href*='/followers']");
        if (followersLink && followersLink.textContent) {
            const match = followersLink.textContent.match(/[\d,.]+/);
            if (match) return match[0].replace(/[,.]/g, "");
        }

        const allText = document.body.innerText;
        const patterns = [
            /(\d+(?:[.,]\d+)*)\s*(?:seguidores?|followers?)/i,
            /(?:seguidores?|followers?)\s*(\d+(?:[.,]\d+)*)/i,
        ];

        for (const pattern of patterns) {
            const match = allText.match(pattern);
            if (match) return match[1].replace(/[,.]/g, "");
        }
        return null;
    });
    return followers;
}

export async function extractFollowing(page: Page, username: string): Promise<string | null> {
    const following = await page.evaluate(() => {
        const followingLink = document.querySelector("a[href*='/following']");
        if (followingLink && followingLink.textContent) {
            const match = followingLink.textContent.match(/[\d,.]+/);
            if (match) return match[0].replace(/[,.]/g, "");
        }

        const allText = document.body.innerText;
        const patterns = [
            /(\d+(?:[.,]\d+)*)\s*(?:seguindo|following)/i,
            /(?:seguindo|following)\s*(\d+(?:[.,]\d+)*)/i,
        ];

        for (const pattern of patterns) {
            const match = allText.match(pattern);
            if (match) return match[1].replace(/[,.]/g, "");
        }
        return null;
    });
    return following;
}

export async function extractPostsCount(page: Page, username: string): Promise<string | null> {
    const postsCount = await page.evaluate(() => {
        const allText = document.body.innerText;
        const patterns = [
            /(\d+(?:[.,]\d+)*)\s*(?:posts?|publicaç(?:ões?|ao))/i,
            /(?:posts?|publicaç(?:ões?|ao))\s*(\d+(?:[.,]\d+)*)/i,
        ];
        for (const pattern of patterns) {
            const match = allText.match(pattern);
            if (match) return match[1].replace(/[,.]/g, "");
        }
        return null;
    });
    return postsCount;
}

export async function scrollToBottom(page: Page, username: string, maxPosts = 50, onLog?: (msg: string) => void) {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let unchangedCount = 0;
    const MAX_SCROLL_ATTEMPTS = 20;
    const SCROLL_DELAY = 2000;
    const MAX_UNCHANGED = 3;

    while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        const currentPosts = await page.evaluate(() => {
            return document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length;
        });

        if (currentPosts >= maxPosts) break;

        const currentHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentHeight === previousHeight) {
            unchangedCount++;
            if (unchangedCount >= MAX_UNCHANGED) break;
        } else {
            unchangedCount = 0;
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await delay(SCROLL_DELAY);

        previousHeight = currentHeight;
        scrollAttempts++;
        if (onLog) onLog(`Scrolling... ${currentPosts} posts loaded`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(1000);
}

export async function extractVideoUrl(page: Page, postUrl: string): Promise<any> {
    const newPage = await page.browser().newPage();
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(1500);

        const videoData = await newPage.evaluate(() => {
            const videoElement = document.querySelector("video");
            if (videoElement) {
                let videoUrl = videoElement.src || null;
                if (!videoUrl || videoUrl.startsWith("blob:")) {
                    const sourceElement = videoElement.querySelector("source");
                    if (sourceElement) videoUrl = sourceElement.src;
                }
                return {
                    videoUrl,
                    poster: videoElement.poster || null,
                    width: videoElement.videoWidth,
                    height: videoElement.videoHeight
                };
            }
            return null;
        });
        await newPage.close();
        return videoData;
    } catch (e) {
        await newPage.close();
        return null;
    }
}

export async function extractCarouselImages(page: Page, postUrl: string): Promise<any> {
    const newPage = await page.browser().newPage();
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(1500);

        const carouselData = await newPage.evaluate(() => {
            const images: any[] = [];
            const imgElements = document.querySelectorAll('img[style*="object-fit"], img[srcset]');
            const seenUrls = new Set();

            for (const img of Array.from(imgElements)) {
                // @ts-ignore
                let url = img.src || img.getAttribute("srcset")?.split(" ")[0] || null;
                if (url && !seenUrls.has(url) && (url.includes("scontent") || url.includes("cdninstagram")) && !url.includes("44x44")) {
                    seenUrls.add(url);
                    // @ts-ignore
                    images.push({ url, alt: img.alt || "" });
                }
            }
            return { totalImages: images.length, images };
        });
        await newPage.close();
        return carouselData;
    } catch (e) {
        await newPage.close();
        return { totalImages: 0, images: [] };
    }
}

export async function extractPostLikes(page: Page, postUrl: string): Promise<string[]> {
    const newPage = await page.browser().newPage();
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(2000);

        // Try to find and click the likes count to open the likes modal
        const likesClicked = await newPage.evaluate(() => {
            // Strategy 1: Button or link containing likes/curtidas text
            const allElements = Array.from(document.querySelectorAll('a, button, span'));
            for (const el of allElements) {
                const text = (el.textContent || '').trim();
                if (/(\d+)\s*(likes?|curtidas?)/i.test(text) || /liked by|curtido por/i.test(text)) {
                    (el as HTMLElement).click();
                    return true;
                }
            }
            // Strategy 2: Section with aria-label related to likes
            const ariaElements = document.querySelectorAll('[aria-label*="like"], [aria-label*="curtida"]');
            for (const el of Array.from(ariaElements)) {
                if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'SPAN') {
                    (el as HTMLElement).click();
                    return true;
                }
            }
            return false;
        });

        if (!likesClicked) {
            console.warn(`[extractPostLikes] Could not find likes button for ${postUrl}`);
            await newPage.close();
            return [];
        }

        await delay(2000);

        // Scroll within the likes modal to load more likers
        for (let i = 0; i < 5; i++) {
            await newPage.evaluate(() => {
                const modal = document.querySelector('div[role="dialog"]');
                if (modal) {
                    const scrollable = modal.querySelector('div[style*="overflow"]') || modal;
                    scrollable.scrollTop = scrollable.scrollHeight;
                }
            });
            await delay(1000);
        }

        // Extract usernames from the modal
        const usernames = await newPage.evaluate(() => {
            const modal = document.querySelector('div[role="dialog"]');
            if (!modal) return [];

            const links = modal.querySelectorAll('a[href^="/"]');
            const names: string[] = [];
            const seen = new Set<string>();

            for (const link of Array.from(links)) {
                const href = link.getAttribute('href') || '';
                // Filter profile links (single path segment like /username/)
                const match = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                if (match && match[1] !== 'explore' && match[1] !== 'accounts') {
                    const username = match[1];
                    if (!seen.has(username)) {
                        seen.add(username);
                        names.push(username);
                    }
                }
            }
            return names;
        });

        if (usernames.length === 0) {
            console.warn(`[extractPostLikes] 0 likes extracted for ${postUrl}`);
        }

        await newPage.close();
        return usernames;
    } catch (e) {
        console.warn(`[extractPostLikes] Error for ${postUrl}:`, e);
        await newPage.close();
        return [];
    }
}

export async function extractPostComments(page: Page, postUrl: string): Promise<Array<{username: string, text: string}>> {
    const newPage = await page.browser().newPage();
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(2000);

        // Try to click "Load more comments" button up to 3 times
        for (let i = 0; i < 3; i++) {
            const clicked = await newPage.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('button, span, a'));
                for (const el of allElements) {
                    const text = (el.textContent || '').trim().toLowerCase();
                    if (
                        text.includes('load more comments') ||
                        text.includes('ver mais comentários') ||
                        text.includes('ver todos os') ||
                        text.includes('view all') ||
                        /^\+$/.test(text) // Plus icon for more comments
                    ) {
                        (el as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            });
            if (!clicked) break;
            await delay(1500);
        }

        // Extract the post author from the URL to skip caption
        const urlMatch = postUrl.match(/instagram\.com\/([^\/]+)/);
        // We cannot reliably get the author from URL since post URLs are /p/CODE/
        // Instead, we'll identify the first comment as caption by checking if it's from the page's og author

        // Extract comments from the post page
        const comments = await newPage.evaluate(() => {
            const results: Array<{username: string, text: string}> = [];
            const seen = new Set<string>();

            // Strategy 1: Look for comment containers - typically ul > li structures
            const commentElements = document.querySelectorAll('ul ul li, div[role="button"]');

            for (const el of Array.from(commentElements)) {
                const link = el.querySelector('a[href^="/"]');
                if (!link) continue;

                const href = link.getAttribute('href') || '';
                const nameMatch = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                if (!nameMatch) continue;

                const username = nameMatch[1];
                if (username === 'explore' || username === 'accounts') continue;

                // Find comment text - typically in a span next to or near the username link
                const spans = el.querySelectorAll('span');
                let commentText = '';
                for (const span of Array.from(spans)) {
                    const spanText = (span.textContent || '').trim();
                    // Skip very short text, timestamps, and the username itself
                    if (
                        spanText.length > 1 &&
                        spanText !== username &&
                        !/^\d+[smhdw]$/.test(spanText) && // Skip timestamps like "2h", "3d"
                        !/^(Reply|Responder|Like|Curtir)$/i.test(spanText)
                    ) {
                        commentText = spanText;
                        break;
                    }
                }

                if (commentText) {
                    const key = `${username}:${commentText}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ username, text: commentText });
                    }
                }
            }

            // Strategy 2: If strategy 1 yielded nothing, try broader approach
            if (results.length === 0) {
                const allLinks = document.querySelectorAll('a[href^="/"]');
                for (const link of Array.from(allLinks)) {
                    const href = link.getAttribute('href') || '';
                    const nameMatch = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                    if (!nameMatch) continue;
                    const username = nameMatch[1];
                    if (username === 'explore' || username === 'accounts' || username === 'p' || username === 'reel') continue;

                    // Look for adjacent text content
                    const parent = link.closest('div, li');
                    if (!parent) continue;

                    const spans = parent.querySelectorAll('span');
                    for (const span of Array.from(spans)) {
                        const spanText = (span.textContent || '').trim();
                        if (
                            spanText.length > 5 &&
                            spanText !== username &&
                            !/^\d+[smhdw]$/.test(spanText) &&
                            !/^(Reply|Responder|Like|Curtir|View|Ver)$/i.test(spanText)
                        ) {
                            const key = `${username}:${spanText}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                results.push({ username, text: spanText });
                            }
                            break;
                        }
                    }
                }
            }

            return results;
        });

        if (comments.length === 0) {
            console.warn(`[extractPostComments] 0 comments extracted for ${postUrl}`);
        }

        // Skip the first comment if it looks like the post caption (usually from the post author)
        // The first entry is often the caption — we keep all for now since we can't reliably detect the author

        await newPage.close();
        return comments;
    } catch (e) {
        console.warn(`[extractPostComments] Error for ${postUrl}:`, e);
        await newPage.close();
        return [];
    }
}

export async function extractPostsData(page: Page, username: string, maxPosts = 50): Promise<any[]> {
    const posts = await page.evaluate((max) => {
        const postsData: any[] = [];
        const seenUrls = new Set();
        const allLinks = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));

        for (let i = 0; i < allLinks.length && postsData.length < max; i++) {
            const link = allLinks[i];
            const href = link.getAttribute("href");
            if (!href) continue;

            let postUrl = href.startsWith("http") ? href : "https://www.instagram.com" + (href.startsWith("/") ? "" : "/") + href;
            if (seenUrls.has(postUrl)) continue;
            seenUrls.add(postUrl);

            let postId = null;
            let mediaType = "unknown";
            if (href.includes("/reel/")) {
                postId = href.match(/\/reel\/([^\/]+)/)?.[1];
                mediaType = "reel";
            } else if (href.includes("/p/")) {
                postId = href.match(/\/p\/([^\/]+)/)?.[1];
                mediaType = "post";
            }

            if (!postId) continue;

            const hasReelIcon = link.querySelector('svg[aria-label*="Clipe"]') !== null;
            if (hasReelIcon) mediaType = "reel";

            // @ts-ignore
            const isCarousel = link.querySelector('svg[aria-label*="Carrossel"]') !== null || link.querySelector('svg[aria-label*="Carousel"]') !== null;

            let imgElement = link.querySelector("img");
            let mediaUrl = null;
            let altText = "";
            if (imgElement) {
                mediaUrl = imgElement.src;
                altText = imgElement.alt;
            }

            postsData.push({
                postId,
                postUrl,
                mediaUrl,
                mediaType,
                altText,
                isCarousel,
                username: null // filled later
            });
        }
        return postsData;
    }, maxPosts);

    return posts;
}
