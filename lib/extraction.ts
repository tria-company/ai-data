
import { Page } from 'puppeteer-core';

// Helper for delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a new page that inherits cookies and proxy auth from the source page.
 */
async function createAuthenticatedPage(sourcePage: Page): Promise<Page> {
    const browser = sourcePage.browser();
    const newPage = await browser.newPage();

    // Copy cookies from source page
    const cookies = await sourcePage.cookies();
    if (cookies.length > 0) {
        await newPage.setCookie(...cookies);
    }

    // Proxy auth (if set via env)
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    if (proxyUsername && proxyPassword) {
        await newPage.authenticate({ username: proxyUsername, password: proxyPassword });
    }

    return newPage;
}

export async function checkIfPrivate(page: Page, onLog?: (msg: string) => void): Promise<boolean> {
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
        if (onLog) onLog(`Error checking privacy: ${err}`);
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
    const newPage = await createAuthenticatedPage(page);
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
    const newPage = await createAuthenticatedPage(page);
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

export async function extractPostLikes(page: Page, postUrl: string, onLog?: (msg: string) => void): Promise<string[]> {
    const newPage = await createAuthenticatedPage(page);
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(2000);

        // Find and click the likes count to open the likes modal
        // Instagram renders likes as a span[role="button"] containing just a number (e.g. "12")
        // located near the like/comment/share action buttons section
        const likesClicked = await newPage.evaluate(() => {
            // Strategy 1: Find span[role="button"] that contains a likes count
            // Handles: "12", "1,234", "5,5 mil", "1.2k", "2 mil", "1,234 curtidas", etc.
            const likeCountPattern = /^\d[\d,.]*(\s*(mil|k|m|b|likes?|curtidas?))?$/i;
            const roleButtons = document.querySelectorAll('span[role="button"]');
            for (const el of Array.from(roleButtons)) {
                const text = (el.textContent || '').trim().replace(/\u00a0/g, ' ');
                if (likeCountPattern.test(text)) {
                    (el as HTMLElement).click();
                    return true;
                }
            }
            // Strategy 2: Look for anchor links containing likes/curtidas text
            const allLinks = document.querySelectorAll('a[href*="/liked_by/"], a[href*="/likes/"]');
            if (allLinks.length > 0) {
                (allLinks[0] as HTMLElement).click();
                return true;
            }
            // Strategy 3: Any clickable element with "likes"/"curtidas" text near the post
            const spans = document.querySelectorAll('span, a, button');
            for (const el of Array.from(spans)) {
                const text = (el.textContent || '').trim().replace(/\u00a0/g, ' ');
                if (/^\d[\d,.]*\s*(likes?|curtidas?)$/i.test(text) || /^(liked by|curtido por)/i.test(text)) {
                    (el as HTMLElement).click();
                    return true;
                }
            }
            return false;
        });

        if (!likesClicked) {
            console.warn(`[extractPostLikes] Could not find likes button for ${postUrl}`);
            if (onLog) onLog(`[extractPostLikes] Could not find likes button for ${postUrl}`);
            await newPage.close();
            return [];
        }

        await delay(2000);

        // Scroll within the likes modal to load more likers
        // Instagram uses div[style*="overflow: hidden auto"] for the scrollable container
        for (let i = 0; i < 5; i++) {
            const hasMore = await newPage.evaluate(() => {
                // Try multiple strategies to find the scrollable likes list
                const scrollable =
                    document.querySelector('div[style*="overflow: hidden auto"]') ||
                    document.querySelector('div[style*="overflow-y: auto"]') ||
                    document.querySelector('div[role="dialog"] div[style*="overflow"]');
                if (scrollable) {
                    const prevTop = scrollable.scrollTop;
                    scrollable.scrollTop = scrollable.scrollHeight;
                    return scrollable.scrollTop > prevTop; // true if we actually scrolled
                }
                return false;
            });
            await delay(1000);
            if (!hasMore && i > 0) break; // Stop if no more content to scroll
        }

        // Extract usernames from the likes modal
        // Instagram profile links use class "notranslate _a6hd" with href="/username/"
        // Username text is in span with classes "_ap3a _aaco _aacw _aacx _aad7 _aade"
        const usernames = await newPage.evaluate(() => {
            const names: string[] = [];
            const seen = new Set<string>();

            // Strategy 1: Find profile links with notranslate class (most reliable)
            const profileLinks = document.querySelectorAll('a.notranslate[href^="/"], a._a6hd[href^="/"]');
            for (const link of Array.from(profileLinks)) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                if (match && !['explore', 'accounts', 'p', 'reel', 'stories'].includes(match[1])) {
                    const username = match[1];
                    if (!seen.has(username)) {
                        seen.add(username);
                        names.push(username);
                    }
                }
            }

            // Strategy 2: If strategy 1 found nothing, try username spans inside the modal
            if (names.length === 0) {
                const scrollContainer = document.querySelector('div[style*="overflow: hidden auto"]') ||
                    document.querySelector('div[role="dialog"]');
                if (scrollContainer) {
                    const links = scrollContainer.querySelectorAll('a[href^="/"]');
                    for (const link of Array.from(links)) {
                        const href = link.getAttribute('href') || '';
                        const match = href.match(/^\/([a-zA-Z0-9_.]+)\/?$/);
                        if (match && !['explore', 'accounts', 'p', 'reel', 'stories'].includes(match[1])) {
                            const username = match[1];
                            if (!seen.has(username)) {
                                seen.add(username);
                                names.push(username);
                            }
                        }
                    }
                }
            }

            return names;
        });

        if (usernames.length === 0) {
            console.warn(`[extractPostLikes] 0 likes extracted for ${postUrl}`);
            if (onLog) onLog(`[extractPostLikes] 0 likes extracted for ${postUrl}`);
        }

        await newPage.close();
        return usernames;
    } catch (e) {
        console.warn(`[extractPostLikes] Error for ${postUrl}:`, e);
        if (onLog) onLog(`[extractPostLikes] Error for ${postUrl}: ${e}`);
        await newPage.close();
        return [];
    }
}

export async function extractPostComments(page: Page, postUrl: string, onLog?: (msg: string) => void): Promise<Array<{username: string, text: string}>> {
    const newPage = await createAuthenticatedPage(page);
    try {
        await newPage.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(2000);

        // Try to click "Load more comments" button up to 3 times
        for (let i = 0; i < 3; i++) {
            const clicked = await newPage.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('button, span, a, div[role="button"]'));
                for (const el of allElements) {
                    const text = (el.textContent || '').trim().toLowerCase();
                    if (
                        text.includes('load more comments') ||
                        text.includes('ver mais comentários') ||
                        text.includes('ver todos os') ||
                        text.includes('view all') ||
                        text.includes('carregar mais comentários')
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

        // Extract comments from the post page.
        // Strategy: find all username links (a._a6hd) with /username/ hrefs,
        // then walk up to the comment container and find the comment text
        // in a nearby span[dir="auto"]. This is resilient to Instagram
        // changing between li/div/ul container elements.
        const comments = await newPage.evaluate(`(function() {
            var results = [];
            var seen = new Set();
            var reservedPaths = ['explore', 'accounts', 'p', 'reel', 'stories', 'direct', 'reels'];

            // Find all username links in the page
            var allLinks = document.querySelectorAll('a._a6hd[href^="/"]');
            for (var i = 0; i < allLinks.length; i++) {
                var link = allLinks[i];
                var href = link.getAttribute('href') || '';
                var nameMatch = href.match(/^\\/([a-zA-Z0-9_.]+)\\/?$/);
                if (!nameMatch) continue;
                var username = nameMatch[1];
                if (reservedPaths.indexOf(username) !== -1) continue;

                // Walk up to find the comment container (up to 8 levels)
                var container = link;
                for (var up = 0; up < 8; up++) {
                    if (!container.parentElement) break;
                    container = container.parentElement;
                    // Stop at a reasonable container boundary
                    var tag = container.tagName.toLowerCase();
                    if (tag === 'li' || tag === 'article') break;
                    // Also stop if container has multiple username links (too high)
                    if (container.querySelectorAll('a._a6hd[href^="/"]').length > 2) {
                        container = container.children[0] || container;
                        break;
                    }
                }

                // Find comment text: span[dir="auto"] that is NOT the username itself
                var spans = container.querySelectorAll('span[dir="auto"]');
                var commentText = '';
                for (var j = 0; j < spans.length; j++) {
                    var t = (spans[j].textContent || '').trim();
                    if (t.length === 0) continue;
                    // Skip if it's the username text
                    if (t === username) continue;
                    // Skip timestamps (e.g. "2 sem", "5h", "3 min")
                    if (/^\\d+\\s*(sem|min|[smhdwya])$/i.test(t)) continue;
                    // Skip action buttons
                    if (/^(Reply|Responder|Curtir|Like|Ver tradução|See translation)$/i.test(t)) continue;
                    // Skip "more" / "mais" expand buttons
                    if (/^(more|mais)$/i.test(t)) continue;
                    // Skip if it only contains a link (profile mention)
                    if (spans[j].children.length === 1 && spans[j].children[0].tagName === 'A') continue;
                    // This is likely the comment text
                    commentText = t;
                    break;
                }

                if (!commentText) continue;

                var key = username + ':' + commentText;
                if (!seen.has(key)) {
                    seen.add(key);
                    results.push({ username: username, text: commentText });
                }
            }

            // Remove the first result if it looks like the post caption (same as post author)
            // The post author's caption is usually the first "comment" found
            if (results.length > 1) {
                // Keep all — the caller can filter the post author if needed
            }

            return results;
        })()`);
        const typedComments = (comments as Array<{username: string, text: string}>);

        if (typedComments.length === 0) {
            console.warn(`[extractPostComments] 0 comments extracted for ${postUrl}`);
            if (onLog) onLog(`[extractPostComments] 0 comments extracted for ${postUrl}`);
        }

        await newPage.close();
        return typedComments;
    } catch (e) {
        console.warn(`[extractPostComments] Error for ${postUrl}:`, e);
        if (onLog) onLog(`[extractPostComments] Error for ${postUrl}: ${e}`);
        await newPage.close();
        return [];
    }
}

export async function extractBio(page: Page, onLog?: (msg: string) => void): Promise<string> {
    try {
        // Click "mais"/"more" to expand truncated bio before extracting
        await page.evaluate(() => {
            const spans = document.querySelectorAll('span[dir="auto"]');
            for (const el of Array.from(spans)) {
                const text = (el.textContent || '').trim().toLowerCase();
                if (text === 'mais' || text === 'more') {
                    (el as HTMLElement).click();
                    break;
                }
            }
        });
        await delay(800);

        // Passed as a string to avoid tsx/esbuild injecting __name() calls inside the function body,
        // which would break execution in the browser context where __name is not defined.
        const bio = await page.evaluate(`(function() {
            var skipPatterns = [
                /^(posts?|followers?|following|publicações|seguidores|seguindo)$/i,
                /^\\d[\\d,.mkMK\\s]*\\s*(posts?|followers?|following|publicações|seguidores|seguindo)$/i,
                /^(seguido|followed)/i,
            ];
            function isSkippable(text) {
                return text.length < 5 ||
                    /^\\d[\\d,.mkMK]*$/.test(text) ||
                    skipPatterns.some(function(p) { return p.test(text); });
            }

            // Strategy 1: Bio span with Instagram's _ap3a class pattern
            var bioSpans = document.querySelectorAll('span._ap3a._aaco._aacu._aacx._aad7._aade[dir="auto"]');
            for (var i = 0; i < bioSpans.length; i++) {
                var text = (bioSpans[i].textContent || '').trim();
                if (text.length >= 5 && !isSkippable(text)) return text;
            }

            // Strategy 2: Look in all <section> elements for bio-like content
            var sections = document.querySelectorAll('section');
            for (var s = 0; s < sections.length; s++) {
                var spans = sections[s].querySelectorAll('span[dir="auto"]');
                for (var j = 0; j < spans.length; j++) {
                    var t = (spans[j].textContent || '').trim();
                    if (isSkippable(t)) continue;
                    if (spans[j].closest('h1') || spans[j].closest('h2')) continue;
                    if (t.length >= 20) return t;
                }
            }

            // Strategy 3: Look inside header (older layouts)
            var headerSection = document.querySelector('header section') || document.querySelector('header');
            if (headerSection) {
                var headerSpans = headerSection.querySelectorAll('span[dir="auto"]');
                for (var k = 0; k < headerSpans.length; k++) {
                    var ht = (headerSpans[k].textContent || '').trim();
                    if (isSkippable(ht)) continue;
                    if (headerSpans[k].closest('h1') || headerSpans[k].closest('h2')) continue;
                    return ht;
                }
            }

            // Strategy 4: Legacy layout
            var legacyBio = document.querySelector('div.-vDIg span');
            if (legacyBio) return (legacyBio.textContent || '').trim();

            return '';
        })()`);

        return (bio as string) || '';
    } catch (e) {
        console.warn('[extractBio] Error:', e);
        if (onLog) onLog(`[extractBio] Error: ${e}`);
        return '';
    }
}

export interface HighlightData {
    title: string;
    coverUrl: string | null;
    highlightUrl: string;
}

export async function extractHighlights(page: Page, username: string, onLog?: (msg: string) => void): Promise<HighlightData[]> {
    const highlights: HighlightData[] = [];

    try {
        const highlightItems = await page.evaluate(() => {
            const items: Array<{ href: string; title: string; coverUrl: string | null }> = [];

            const highlightLinks = document.querySelectorAll('a[href*="/stories/highlights/"]');
            for (const link of Array.from(highlightLinks)) {
                const href = link.getAttribute('href') || '';

                // Extract title from aria-label ("Ver destaque de TITLE")
                const ariaLabel = link.getAttribute('aria-label') || '';
                let title = '';
                const labelMatch = ariaLabel.match(/Ver destaque de (.+)/i) || ariaLabel.match(/View (.+) highlight/i);
                if (labelMatch) {
                    title = labelMatch[1].trim();
                }

                // Fallback: get title from inner span
                if (!title) {
                    const spans = link.querySelectorAll('span');
                    for (const span of Array.from(spans)) {
                        const text = (span.textContent || '').trim();
                        if (text.length > 0 && text.length < 60 && !text.includes('http')) {
                            title = text;
                        }
                    }
                }

                // Get cover image
                const img = link.querySelector('img[height="72"], img[width="72"]') ||
                    link.querySelector('img');
                const coverUrl = img ? (img as HTMLImageElement).src : null;

                if (href) {
                    items.push({
                        href,
                        title: title || `Destaque ${items.length + 1}`,
                        coverUrl
                    });
                }
            }

            return items;
        });

        if (highlightItems.length === 0) {
            if (onLog) onLog(`[extractHighlights] No highlights found for ${username}`);
            return [];
        }

        for (const hl of highlightItems) {
            const highlightUrl = hl.href.startsWith('http')
                ? hl.href
                : `https://www.instagram.com${hl.href}`;

            highlights.push({
                title: hl.title,
                coverUrl: hl.coverUrl,
                highlightUrl
            });
        }

        if (onLog) onLog(`[extractHighlights] Found ${highlights.length} highlights for ${username}`);

    } catch (e) {
        console.warn(`[extractHighlights] Error for ${username}:`, e);
        if (onLog) onLog(`[extractHighlights] Error for ${username}: ${e}`);
    }

    return highlights;
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
