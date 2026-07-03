import { Queue } from 'bullmq';
import redis from '../config/redis.js';
import { logger } from '../config/logger.js';

const webhookQueue = new Queue('webhook', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,              // retry up to 5 times
    backoff: {
      type: 'exponential',
      delay: 5000,            // 5s → 25s → 125s → 625s → 3125s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

webhookQueue.on('error', (err) => {
  logger.error('Webhook queue error', { error: err.message });
});

export const addDeliveryJob = async ({ webhookId, deliveryId, url, secret, event, payload }) => {
  const job = await webhookQueue.add('deliver-webhook', {
    webhookId,
    deliveryId,
    url,
    secret,
    event,
    payload,
  });

  logger.info('Delivery job added to queue', {
    jobId: job.id,
    webhookId,
    event,
  });

  return job;
};

export default webhookQueue;