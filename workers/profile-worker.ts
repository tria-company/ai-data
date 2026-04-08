import { Worker, Job } from 'bullmq';
import { connection, postDetailsQueue, profileScrapeQueue } from '../lib/queue';
import { getBrowser } from '../lib/browser';
import { selectAccount, markAccountInvalid, isCookieError, hasValidAccounts } from '../lib/account-selector';
import { sendNoAccountsAlert } from '../lib/notifications';
import { decrypt } from '../lib/encryption';
import { supabase } from '../lib/supabase';
import {
  checkIfPrivate,
  extractBio,
  extractHighlights,
  scrollToBottom,
  extractPostsData,
} from '../lib/extraction';
import { Protocol } from 'puppeteer-core';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ProfileJobData {
  username: string;
  projetoId: string | null;
  maxPosts?: number;
}

async function processProfileJob(job: Job<ProfileJobData>) {
  const { username, projetoId, maxPosts = 50 } = job.data;
  const cleanUsername = username.replace('@', '').trim();

  console.log(`[profile-worker] Processing job ${job.id} for @${cleanUsername}`);

  // Account selection loop — try accounts sequentially within the SAME job
  const triedAccounts: { username: string; reason: string }[] = [];
  let account = await selectAccount();
  while (account) {
    try {
      const result = await scrapeProfile(job, account, cleanUsername, projetoId, maxPosts);
      return result;
    } catch (error) {
      if (isCookieError(error)) {
        triedAccounts.push({ username: account.username, reason: 'Invalid cookies (login redirect)' });
        console.warn(`[profile-worker] Cookie error for account ${account.username}, trying next...`);
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
    await profileScrapeQueue.add('profile-scrape', job.data, {
      delay: 90 * 1000, // 90 seconds
    });
    console.log(`[profile-worker] Accounts rate-limited, re-queued with 90s delay`);
    return { status: 'requeued', reason: 'rate_limited' };
  }

  // No valid accounts at all — send email alert + long delay
  await sendNoAccountsAlert({
    jobId: job.id!,
    username: cleanUsername,
    triedAccounts,
    queueName: 'profile-scrape',
  });

  await profileScrapeQueue.add('profile-scrape', job.data, {
    delay: 30 * 60 * 1000, // 30 minutes
  });
  console.log(`[profile-worker] No accounts available, re-queued with 30min delay`);
  return { status: 'requeued', reason: 'no_accounts_available' };
}

async function scrapeProfile(
  job: Job<ProfileJobData>,
  account: any,
  cleanUsername: string,
  projetoId: string | null,
  maxPosts: number,
) {
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

    console.log(`[profile-worker] Cookies loaded for @${cleanUsername}, navigating...`);

    // Navigate to profile
    await page.goto(`https://www.instagram.com/${cleanUsername}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await delay(Math.random() * 2000 + 2000);

    // Check if redirected to login or challenge page
    const currentUrl = page.url();
    if (currentUrl.includes('accounts/login') || currentUrl.includes('challenge') || !currentUrl.includes(cleanUsername)) {
      console.warn(`[profile-worker] Redirected to ${currentUrl} — cookies invalid for account ${account.username}`);
      throw new Error(`Cookie invalid: redirected to challenge page`);
    }

    // Check if private
    const isPrivate = await checkIfPrivate(page);
    if (isPrivate) {
      console.log(`[profile-worker] @${cleanUsername} is private, skipping`);
      return { status: 'skipped', reason: 'private_account', username: cleanUsername };
    }

    // Extract bio
    let bio = '';
    try {
      bio = await extractBio(page);
      if (bio) {
        await supabase
          .from('profile_bio')
          .upsert(
            {
              username: cleanUsername,
              bio,
              updated_at: new Date().toISOString(),
              ...(projetoId ? { projeto: projetoId } : {}),
            },
            { onConflict: 'username' },
          );
        console.log(`[profile-worker] Bio saved for @${cleanUsername}`);
      }
    } catch (e: any) {
      console.warn(`[profile-worker] Bio extraction failed for @${cleanUsername}: ${e.message}`);
    }
    await job.updateProgress(20);

    // Extract highlights
    let highlightsData: any[] = [];
    try {
      highlightsData = await extractHighlights(page, cleanUsername);
      if (highlightsData.length > 0) {
        for (const hl of highlightsData) {
          const { data: hlRows } = await supabase
            .from('profile_highlights')
            .upsert(
              {
                username: cleanUsername,
                title: hl.title,
                cover_url: hl.coverUrl,
                highlight_url: hl.highlightUrl,
                ...(projetoId ? { projeto: projetoId } : {}),
              },
              { onConflict: 'username,title' },
            )
            .select('id');

          // Save cover image as a highlight item
          if (hlRows && hlRows.length > 0 && hl.coverUrl) {
            await supabase.from('profile_highlight_items').insert({
              highlight_id: hlRows[0].id,
              media_url: hl.coverUrl,
              media_type: 'image',
              ...(projetoId ? { projeto: projetoId } : {}),
            });
          }
        }
        console.log(`[profile-worker] ${highlightsData.length} highlights saved for @${cleanUsername}`);
      }
    } catch (e: any) {
      console.warn(`[profile-worker] Highlights extraction failed for @${cleanUsername}: ${e.message}`);
    }
    await job.updateProgress(40);

    // Scroll and extract posts
    await scrollToBottom(page, cleanUsername, maxPosts);
    const posts = await extractPostsData(page, cleanUsername, maxPosts);

    // Save posts to DB
    const postsPayload = posts.map((post: any) => ({
      username: cleanUsername,
      postid: post.postId,
      posturl: post.postUrl,
      mediatype: post.mediaType,
      alttext: post.altText,
      mediaurl: post.mediaUrl,
      videourl: post.videoUrl || null,
      iscarousel: post.isCarousel,
      carouselimages: post.carouselImages || [],
      updated_at: new Date().toISOString(),
      ...(projetoId ? { projeto: projetoId } : {}),
    }));

    if (postsPayload.length > 0) {
      const { error: insertError } = await supabase
        .from('scrappers_contents')
        .upsert(postsPayload, {
          onConflict: 'postid',
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error(`[profile-worker] Error saving posts for @${cleanUsername}: ${insertError.message}`);
      } else {
        console.log(`[profile-worker] Saved ${postsPayload.length} posts for @${cleanUsername}`);
      }
    }
    await job.updateProgress(80);

    // Enqueue post-details jobs
    const postJobs = posts.map((post: any) => ({
      name: 'post-details',
      data: {
        postId: post.postId,
        postUrl: post.postUrl,
        mediaType: post.mediaType,
        isCarousel: post.isCarousel,
        username: cleanUsername,
        projetoId,
      },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 30000 },
      },
    }));

    if (postJobs.length > 0) {
      await postDetailsQueue.addBulk(postJobs);
      console.log(`[profile-worker] Enqueued ${postJobs.length} post-details jobs for @${cleanUsername}`);
    }
    await job.updateProgress(100);

    // Upsert users_scrapping with completion status
    try {
      const now = new Date().toISOString();
      let updateQuery = supabase
        .from('users_scrapping')
        .update({ status: 'completed', data_ultimo_scrapping: now })
        .eq('user', cleanUsername);
      if (projetoId) updateQuery = updateQuery.eq('projeto', projetoId);
      const { data: updated } = await updateQuery.select('id');
      if (!updated || updated.length === 0) {
        // Row doesn't exist yet — create it
        await supabase.from('users_scrapping').insert({
          user: cleanUsername,
          ...(projetoId ? { projeto: projetoId } : {}),
          status: 'completed',
          data_ultimo_scrapping: now,
        });
      }
      console.log(`[profile-worker] users_scrapping upserted for @${cleanUsername}`);
    } catch (e: any) {
      console.warn(`[profile-worker] Failed to upsert users_scrapping: ${e.message}`);
    }

    return {
      status: 'success',
      username: cleanUsername,
      postsFound: posts.length,
      bio: !!bio,
      highlights: highlightsData.length,
      postJobsEnqueued: postJobs.length,
    };
  } finally {
    await browser.close();
  }
}

// Create worker with rate limiting and concurrency controls
const worker = new Worker('profile-scrape', processProfileJob, {
  connection,
  concurrency: 1,
  limiter: { max: 2, duration: 60000 },
});

worker.on('error', (err) => console.error('[profile-worker] Error:', err));
worker.on('completed', (job) => console.log(`[profile-worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[profile-worker] Job ${job?.id} failed:`, err.message));

async function shutdown() {
  console.log('[profile-worker] Shutting down...');
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[profile-worker] Started, waiting for jobs...');
