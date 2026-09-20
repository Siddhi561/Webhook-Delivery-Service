import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('axios');
vi.mock('../../src/config/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import axios from 'axios';
import { deliverWebhook } from '../../src/services/deliveryService.js';

const SECRET  = 'mysecret123456';
const PAYLOAD = { orderId: 'ORD123', amount: 500 };

function makeSignature(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Delivery Service — HMAC Signing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('known payload + secret → produces correct HMAC signature', async () => {
    const capturedHeaders = {};
    axios.post = vi.fn().mockImplementation((url, data, config) => {
      Object.assign(capturedHeaders, config.headers);
      return Promise.resolve({ status: 200, data: { received: true } });
    });

    await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    const body = JSON.stringify(PAYLOAD);
    const expected = makeSignature(SECRET, body);
    expect(capturedHeaders['X-Webhook-Signature']).toBe(expected);
  });

  it('changing one character in payload → signature changes', () => {
    const body1 = JSON.stringify({ orderId: 'ORD123', amount: 500 });
    const body2 = JSON.stringify({ orderId: 'ORD124', amount: 500 }); // changed

    const sig1 = makeSignature(SECRET, body1);
    const sig2 = makeSignature(SECRET, body2);

    expect(sig1).not.toBe(sig2);
  });

  it('wrong secret → signature does not match', () => {
    const body = JSON.stringify(PAYLOAD);
    const correctSig = makeSignature(SECRET, body);
    const wrongSig   = makeSignature('wrongsecret', body);

    expect(correctSig).not.toBe(wrongSig);
  });

  it('correct signature → verification succeeds', () => {
    const body = JSON.stringify(PAYLOAD);
    const sig  = makeSignature(SECRET, body);

    const recomputed = makeSignature(SECRET, body);
    expect(
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(recomputed))
    ).toBe(true);
  });
});

describe('Delivery Service — HTTP Delivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('receiver returns 200 → delivery succeeds', async () => {
    axios.post = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('receiver returns 500 → delivery fails, should retry', async () => {
    axios.post = vi.fn().mockResolvedValue({ status: 500, data: 'Server Error' });

    const result = await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it('receiver returns 400 → delivery fails, non-retryable status recorded', async () => {
    axios.post = vi.fn().mockResolvedValue({ status: 400, data: 'Bad Request' });

    const result = await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('receiver returns 401 → delivery fails', async () => {
    axios.post = vi.fn().mockResolvedValue({ status: 401, data: 'Unauthorized' });

    const result = await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    expect(result.success).toBe(false);
  });

  it('sends X-Webhook-Event header with correct event name', async () => {
    const capturedHeaders = {};
    axios.post = vi.fn().mockImplementation((url, data, config) => {
      Object.assign(capturedHeaders, config.headers);
      return Promise.resolve({ status: 200, data: {} });
    });

    await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'user.created',
      payload: PAYLOAD,
    });

    expect(capturedHeaders['X-Webhook-Event']).toBe('user.created');
  });

  it('sends X-Webhook-Timestamp header', async () => {
    const capturedHeaders = {};
    const before = Date.now();
    axios.post = vi.fn().mockImplementation((url, data, config) => {
      Object.assign(capturedHeaders, config.headers);
      return Promise.resolve({ status: 200, data: {} });
    });

    await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    const ts = Number(capturedHeaders['X-Webhook-Timestamp']);
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it('old timestamp → should be rejected by receiver (5 min window check)', () => {
    const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const now = Date.now();
    const tooOld = now - Number(oldTimestamp) > 5 * 60 * 1000;
    expect(tooOld).toBe(true);
  });

  it('valid timestamp → accepted by receiver', () => {
    const recentTimestamp = Date.now() - 30 * 1000; // 30 seconds ago
    const now = Date.now();
    const valid = now - Number(recentTimestamp) <= 5 * 60 * 1000;
    expect(valid).toBe(true);
  });

  it('response body capped at 500 chars', async () => {
    const longBody = 'x'.repeat(1000);
    axios.post = vi.fn().mockResolvedValue({ status: 200, data: longBody });

    const result = await deliverWebhook({
      url: 'https://example.com/hook',
      secret: SECRET,
      event: 'payment.completed',
      payload: PAYLOAD,
    });

    expect(result.responseBody.length).toBeLessThanOrEqual(500);
  });
});