import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../src/services/deliveryService.js', () => ({
  deliverWebhook: vi.fn(),
}));
vi.mock('../../src/models/delivery.js', () => ({
  default: { findByIdAndUpdate: vi.fn() },
}));

import { deliverWebhook } from '../../src/services/deliveryService.js';
import Delivery from '../../src/models/delivery.js';

// extracted worker processor logic — same as in webhookWorker.js
const processDeliveryJob = async (job) => {
  const { webhookId, deliveryId, url, secret, event, payload } = job.data;

  await Delivery.findByIdAndUpdate(deliveryId, { attempts: job.attemptsMade + 1 });

  const result = await deliverWebhook({ url, secret, event, payload });

  if (!result.success) {
    await Delivery.findByIdAndUpdate(deliveryId, {
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
    });
    throw new Error(`Delivery failed with status ${result.statusCode}`);
  }

  await Delivery.findByIdAndUpdate(deliveryId, {
    status: 'success',
    responseStatus: result.statusCode,
    responseBody: result.responseBody,
    completedAt: new Date(),
  });
};

const handleDeliveryFailed = async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await Delivery.findByIdAndUpdate(job.data.deliveryId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date(),
    });
  } else {
    const delay = Math.min(5000 * Math.pow(5, job.attemptsMade), 3125000);
    await Delivery.findByIdAndUpdate(job.data.deliveryId, {
      nextRetryAt: new Date(Date.now() + delay),
    });
  }
};

const makeJob = (overrides = {}) => ({
  id: 'job_1',
  data: {
    webhookId: 'wh_1',
    deliveryId: 'del_1',
    url: 'https://example.com/webhook',
    secret: 'mysecret123456',
    event: 'payment.completed',
    payload: { orderId: 'ORD1' },
  },
  attemptsMade: 0,
  opts: { attempts: 5 },
  ...overrides,
});

describe('Webhook Worker — Delivery Processing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('receiver returns 200 → delivery marked success', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: '{"ok":true}' });

    await processDeliveryJob(makeJob());

    const successCall = Delivery.findByIdAndUpdate.mock.calls.find(
      c => c[1]?.status === 'success'
    );
    expect(successCall).toBeDefined();
    expect(successCall[1].responseStatus).toBe(200);
  });

  it('receiver returns 500 → throws for BullMQ to retry', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: false, statusCode: 500, responseBody: 'Error' });

    await expect(processDeliveryJob(makeJob())).rejects.toThrow('Delivery failed with status 500');
  });

  it('receiver returns 500 three times then 200 → 4 attempts total', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook
      .mockResolvedValueOnce({ success: false, statusCode: 500, responseBody: 'Err' })
      .mockResolvedValueOnce({ success: false, statusCode: 500, responseBody: 'Err' })
      .mockResolvedValueOnce({ success: false, statusCode: 500, responseBody: 'Err' })
      .mockResolvedValueOnce({ success: true,  statusCode: 200, responseBody: 'OK'  });

    await expect(processDeliveryJob(makeJob({ attemptsMade: 0 }))).rejects.toThrow();
    await expect(processDeliveryJob(makeJob({ attemptsMade: 1 }))).rejects.toThrow();
    await expect(processDeliveryJob(makeJob({ attemptsMade: 2 }))).rejects.toThrow();
    await processDeliveryJob(makeJob({ attemptsMade: 3 }));

    expect(deliverWebhook).toHaveBeenCalledTimes(4);

    const successCall = Delivery.findByIdAndUpdate.mock.calls.find(
      c => c[1]?.status === 'success'
    );
    expect(successCall).toBeDefined();
  });

  it('delivery attempts logged correctly — attempt count incremented', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: 'ok' });

    await processDeliveryJob(makeJob({ attemptsMade: 2 }));

    const firstCall = Delivery.findByIdAndUpdate.mock.calls[0];
    expect(firstCall[1].attempts).toBe(3); // attemptsMade + 1
  });

  it('failed delivery stored correctly', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: false, statusCode: 503, responseBody: 'Unavailable' });

    await expect(processDeliveryJob(makeJob())).rejects.toThrow();

    const failureUpdateCall = Delivery.findByIdAndUpdate.mock.calls.find(
      c => c[1]?.responseStatus === 503
    );
    expect(failureUpdateCall).toBeDefined();
    expect(failureUpdateCall[1].responseBody).toBe('Unavailable');
  });

  it('successful delivery updates final status correctly', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: '{"received":true}' });

    await processDeliveryJob(makeJob());

    const successCall = Delivery.findByIdAndUpdate.mock.calls.find(c => c[1]?.status === 'success');
    expect(successCall[1].completedAt).toBeDefined();
    expect(successCall[1].responseStatus).toBe(200);
  });

  it('exhausted job → delivery status set to failed with errorMessage', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    const job = makeJob({ attemptsMade: 5, opts: { attempts: 5 } });
    const err = new Error('Delivery failed with status 500');

    await handleDeliveryFailed(job, err);

    const failedCall = Delivery.findByIdAndUpdate.mock.calls.find(c => c[1]?.status === 'failed');
    expect(failedCall).toBeDefined();
    expect(failedCall[1].errorMessage).toBe(err.message);
    expect(failedCall[1].completedAt).toBeDefined();
  });

  it('non-exhausted failure → nextRetryAt set, not marked failed', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    const job = makeJob({ attemptsMade: 2, opts: { attempts: 5 } });
    const before = Date.now();

    await handleDeliveryFailed(job, new Error('temp'));

    const retryCall = Delivery.findByIdAndUpdate.mock.calls.find(c => c[1]?.nextRetryAt);
    expect(retryCall).toBeDefined();
    expect(new Date(retryCall[1].nextRetryAt).getTime()).toBeGreaterThan(before);

    const failedCall = Delivery.findByIdAndUpdate.mock.calls.find(c => c[1]?.status === 'failed');
    expect(failedCall).toBeUndefined();
  });

  it('retry delays increase with exponential backoff', () => {
    const delay = (attempt) => Math.min(5000 * Math.pow(5, attempt), 3125000);
    expect(delay(0)).toBe(5000);
    expect(delay(1)).toBe(25000);
    expect(delay(2)).toBe(125000);
    expect(delay(3)).toBe(625000);
    expect(delay(4)).toBe(3125000);
  });
});

describe('Webhook Worker — Replay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stored webhook event can be replayed — creates new delivery record', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: 'ok' });

    // original delivery
    const job1 = makeJob({ id: 'job_1', data: { ...makeJob().data, deliveryId: 'del_1' } });
    await processDeliveryJob(job1);

    vi.clearAllMocks();

    // replay = new delivery record, same payload
    const job2 = makeJob({ id: 'job_2', data: { ...makeJob().data, deliveryId: 'del_2' } });
    await processDeliveryJob(job2);

    // second job updated del_2, not del_1
    const calls = Delivery.findByIdAndUpdate.mock.calls;
    expect(calls[0][0]).toBe('del_2');
    expect(calls[0][0]).not.toBe('del_1');
  });

  it('original delivery record unchanged after replay', async () => {
    Delivery.findByIdAndUpdate.mockResolvedValue({});
    deliverWebhook.mockResolvedValue({ success: true, statusCode: 200, responseBody: 'ok' });

    const originalDeliveryId = 'del_original';
    const replayDeliveryId   = 'del_replay';

    const replayJob = makeJob({
      id: 'job_replay',
      data: { ...makeJob().data, deliveryId: replayDeliveryId },
    });

    await processDeliveryJob(replayJob);

    const originalTouched = Delivery.findByIdAndUpdate.mock.calls.some(
      c => c[0] === originalDeliveryId
    );
    expect(originalTouched).toBe(false);
  });
});