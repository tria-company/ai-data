
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
