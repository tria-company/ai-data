import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? Number(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
};

const defaultJobOptions = {
  removeOnComplete: { age: 86400, count: 200 },
  removeOnFail: { age: 604800, count: 500 },
};

export const profileScrapeQueue = new Queue('profile-scrape', {
  connection,
  defaultJobOptions,
});

export const postDetailsQueue = new Queue('post-details', {
  connection,
  defaultJobOptions,
});

export { connection };
