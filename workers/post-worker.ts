import { Worker, Job } from 'bullmq';
import { connection, postDetailsQueue } from '../lib/queue';
import { getBrowser } from '../lib/browser';
import { selectAccount, markAccountInvalid, isCookieError, hasValidAccounts } from '../lib/account-selector';
import { sendNoAccountsAlert } from '../lib/notifications';
import { decrypt } from '../lib/encryption';
import { getSupabaseForJob } from '../lib/supabase';
import {
  extractVideoUrl,
  extractCarouselImages,
  extractPostLikes,
  extractPostComments,
} from '../lib/extraction';
import { Protocol } from 'puppeteer-core';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface PostJobData {
  postId: string;
  postUrl: string;
  mediaType: string;
  isCarousel: boolean;
  username: string;
  projetoId: string | null;
  dbAccount?: string | null;
}

async function processPostJob(job: Job<PostJobData>) {
  const { postId, postUrl, mediaType, isCarousel, username, projetoId, dbAccount } = job.data;

  console.log(`[post-worker] Processing job ${job.id} for post ${postId} (@${username})`);

  // Account selection loop — try accounts sequentially within the SAME job
  const triedAccounts: { username: string; reason: string }[] = [];
  let account = await selectAccount();
  while (account) {
    try {
      const result = await scrapePostDetails(job, account, postId, postUrl, mediaType, isCarousel, username, projetoId, dbAccount);
      return result;
    } catch (error) {
      if (isCookieError(error)) {
        triedAccounts.push({ username: account.username, reason: 'Invalid cookies (login redirect)' });
        console.warn(`[post-worker] Cookie error for account ${account.username}, trying next...`);
        await markAccountInvalid(account.id);
        account = await selectAccount();
        continue;
      }
      throw error; // non-cookie errors trigger BullMQ retry
    }
  }

  // Distinguish: rate-limited temporarily vs no valid accounts at all
  const accountsExist = await hasValidAccounts();
  if (accountsExist) {
    // Accounts exist but are in cooldown — retry in 90s, no alert
    await postDetailsQueue.add('post-details', job.data, {
      delay: 90 * 1000, // 90 seconds (well above the 30s rate-limit TTL)
    });
    console.log(`[post-worker] Accounts rate-limited, re-queued with 90s delay`);
    return { status: 'requeued', reason: 'rate_limited' };
  }

  // No valid accounts at all — send email alert + long delay
  await sendNoAccountsAlert({
    jobId: job.id!,
    username,
    triedAccounts,
    queueName: 'post-details',
  });

  await postDetailsQueue.add('post-details', job.data, {
    delay: 30 * 60 * 1000, // 30 minutes
  });
  console.log(`[post-worker] No accounts available, re-queued with 30min delay`);
  return { status: 'requeued', reason: 'no_accounts_available' };
}

async function scrapePostDetails(
  job: Job<PostJobData>,
  account: any,
  postId: string,
  postUrl: string,
  mediaType: string,
  isCarousel: boolean,
  username: string,
  projetoId: string | null,
  dbAccount: string | null | undefined,
) {
  const db = getSupabaseForJob(dbAccount, projetoId);
  // Decrypt cookies
  let cookies: Protocol.Network.CookieParam[] = [];
  const sessionData = account.session_cookies;
  if (sessionData.encrypted) {
    const decryptedJson = decrypt(sessionData.encrypted);
    cookies = JSON.parse(decryptedJson);
  } else {
    cookies = sessionData;
  }

  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    if (proxyUsername && proxyPassword) {
      await page.authenticate({ username: proxyUsername, password: proxyPassword });
    }

    // Set cookies (sanitize for Puppeteer compatibility)
    if (cookies && cookies.length > 0) {
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

    console.log(`[post-worker] Cookies loaded for post ${postId}, processing...`);

    const updateData: Record<string, any> = {};

    // Extract video URL for reels
    if (mediaType === 'reel') {
      try {
        const videoData = await extractVideoUrl(page, postUrl);
        if (videoData && videoData.videoUrl) {
          updateData.videourl = videoData.videoUrl;
          console.log(`[post-worker] Video URL extracted for post ${postId}`);
        }
      } catch (e: any) {
        console.warn(`[post-worker] Video extraction failed for post ${postId}: ${e.message}`);
      }
    }

    // Extract carousel images
    if (isCarousel) {
      try {
        const carouselData = await extractCarouselImages(page, postUrl);
        if (carouselData && carouselData.images) {
          updateData.carouselimages = carouselData.images.map((img: any) => img.url);
          console.log(`[post-worker] ${carouselData.images.length} carousel images extracted for post ${postId}`);
        }
      } catch (e: any) {
        console.warn(`[post-worker] Carousel extraction failed for post ${postId}: ${e.message}`);
      }
    }

    // Update scrappers_contents if we got new data
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      const { error } = await db
        .from('scrappers_contents')
        .update(updateData)
        .eq('postid', postId);

      if (error) {
        console.error(`[post-worker] Error updating post ${postId}: ${error.message}`);
      }
    }

    // Extract likes
    let likesCount = 0;
    try {
      const likes = await extractPostLikes(page, postUrl);
      if (likes && likes.length > 0) {
        const likesPayload = likes.map((liker: string) => ({
          postid: postId,
          liker_username: liker,
          perfil: username,
          ...(projetoId ? { projeto: projetoId } : {}),
        }));

        const { error: likesError } = await db
          .from('post_likes')
          .upsert(likesPayload, {
            onConflict: 'postid,liker_username',
            ignoreDuplicates: true,
          });

        if (likesError) {
          console.error(`[post-worker] Error saving likes for post ${postId}: ${likesError.message}`);
        } else {
          likesCount = likes.length;
          console.log(`[post-worker] Saved ${likesCount} likes for post ${postId}`);
        }
      }
    } catch (e: any) {
      console.warn(`[post-worker] Likes extraction failed for post ${postId}: ${e.message}`);
    }
    await job.updateProgress(50);

    // Extract comments
    let commentsCount = 0;
    try {
      const comments = await extractPostComments(page, postUrl);
      if (comments && comments.length > 0) {
        const commentsPayload = comments.map((comment: { username: string; text: string }) => ({
          postid: postId,
          commenter_username: comment.username,
          comment_text: comment.text,
          perfil: username,
          ...(projetoId ? { projeto: projetoId } : {}),
        }));

        const { error: commentsError } = await db
          .from('post_comments')
          .upsert(commentsPayload, {
            onConflict: 'postid,commenter_username,comment_text',
            ignoreDuplicates: true,
          });

        if (commentsError) {
          console.error(`[post-worker] Error saving comments for post ${postId}: ${commentsError.message}`);
        } else {
          commentsCount = comments.length;
          console.log(`[post-worker] Saved ${commentsCount} comments for post ${postId}`);
        }
      }
    } catch (e: any) {
      console.warn(`[post-worker] Comments extraction failed for post ${postId}: ${e.message}`);
    }
    await job.updateProgress(100);

    return {
      status: 'success',
      postId,
      username,
      likes: likesCount,
      comments: commentsCount,
      videoExtracted: !!updateData.videourl,
      carouselExtracted: !!updateData.carouselimages,
    };
  } finally {
    await browser.close();
  }
}

// Create worker with rate limiting and concurrency controls
const worker = new Worker('post-details', processPostJob, {
  connection,
  concurrency: 1,
  limiter: { max: 2, duration: 60000 },
});

worker.on('error', (err) => console.error('[post-worker] Error:', err));
worker.on('completed', (job) => console.log(`[post-worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[post-worker] Job ${job?.id} failed:`, err.message));

async function shutdown() {
  console.log('[post-worker] Shutting down...');
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[post-worker] Started, waiting for jobs...');
