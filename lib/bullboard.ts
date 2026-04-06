import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { profileScrapeQueue, postDetailsQueue } from './queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(profileScrapeQueue),
    new BullMQAdapter(postDetailsQueue),
  ],
  serverAdapter,
});

export { serverAdapter };
