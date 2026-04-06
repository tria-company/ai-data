import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? Number(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
};

export const profileScrapeQueue = new Queue('profile-scrape', { connection });
export const postDetailsQueue = new Queue('post-details', { connection });

export { connection };
