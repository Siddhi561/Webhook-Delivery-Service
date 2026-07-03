import { Worker } from 'bullmq';
import redis from '../config/redis.js';
import { deliverWebhook } from '../services/deliveryService.js';
import Delivery from '../models/delivery.js';
import connectDB from '../config/db.js';
import { logger } from '../config/logger.js';

const worker = new Worker(
  'webhook', // must match queue name
  async (job) => {
    const { webhookId, deliveryId, url, secret, event, payload } = job.data;

    logger.info('Processing delivery job', {
      jobId: job.id,
      webhookId,
      event,
      attempt: job.attemptsMade + 1,
    });

    // update delivery — mark as in progress
    await Delivery.findByIdAndUpdate(deliveryId, {
      attempts: job.attemptsMade + 1,
    });

    // attempt the delivery
    const result = await deliverWebhook({ url, secret, event, payload });

    if (!result.success) {
      // update delivery with failure details
      await Delivery.findByIdAndUpdate(deliveryId, {
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
      });

     
      throw new Error(`Delivery failed with status ${result.statusCode}`);
    }

    // success — update delivery record
    await Delivery.findByIdAndUpdate(deliveryId, {
      status: 'success',
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
      completedAt: new Date(),
    });

    logger.info('Delivery successful', {
      jobId: job.id,
      webhookId,
      event,
      statusCode: result.statusCode,
    });
  },
  {
    connection: redis,
    concurrency: 10, 
  }
);

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', async (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    error: err.message,
  });

  // only mark permanently failed after ALL retries exhausted
  const isExhausted = job.attemptsMade >= job.opts.attempts;

  if (isExhausted) {
    await Delivery.findByIdAndUpdate(job.data.deliveryId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date(),
    });

    logger.warn('Delivery permanently failed', {
      webhookId: job.data.webhookId,
      event: job.data.event,
      attempts: job.attemptsMade,
    });
  } else {
    // calculate when next retry will happen for display purposes
    const delay = Math.min(5000 * Math.pow(5, job.attemptsMade), 3125000);
    await Delivery.findByIdAndUpdate(job.data.deliveryId, {
      nextRetryAt: new Date(Date.now() + delay),
    });
  }
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// connect to MongoDB before worker starts accepting jobs
try {
  await connectDB();
  logger.info('Worker ready');
} catch (err) {
  logger.error('Worker failed to start', { error: err.message });
  process.exit(1);
}

export default worker;
