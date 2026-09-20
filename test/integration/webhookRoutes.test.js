
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/config/db.js', () => ({
  default: { connect: vi.fn() },
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  default: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

vi.mock('../../src/services/webhookService.js');
vi.mock('../../src/services/eventService.js');

import app from '../../src/app.js';
import * as webhookService from '../../src/services/webhookService.js';
import * as eventService from '../../src/services/eventService.js';

describe('POST /api/webhooks/create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valid payload → returns 201 with webhook data', async () => {
    webhookService.createWebhook = vi.fn().mockResolvedValue({
      id: 'wh_1',
      url: 'https://example.com',
      events: ['payment.completed'],
      secret: 'abc123',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        url: 'https://example.com',
        secret: 'mysecret123',
        events: ['payment.completed'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secret).toBeDefined();
  });

  it('missing url → returns 400 validation error', async () => {
    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        secret: 'mysecret123',
        events: ['payment.completed'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('invalid URL format → returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        url: 'not-a-url',
        secret: 'mysecret123',
        events: ['payment.completed'],
      });

    expect(res.status).toBe(400);
  });

  it('missing secret → returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        url: 'https://example.com',
        events: ['payment.completed'],
      });

    expect(res.status).toBe(400);
  });

  it('empty events array → returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        url: 'https://example.com',
        secret: 'mysecret123',
        events: [],
      });

    expect(res.status).toBe(400);
  });

  it('invalid event data → rejected cleanly', async () => {
    const res = await request(app)
      .post('/api/webhooks/create')
      .send({
        url: 'https://example.com',
        secret: 'mysecret123',
        events: 'not-an-array',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/events/trigger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valid event → returns 202 with delivery info', async () => {
    eventService.triggerEvent = vi.fn().mockResolvedValue({
      deliveriesCreated: 2,
      deliveryIds: ['del_1', 'del_2'],
    });

    const res = await request(app)
      .post('/api/events/trigger')
      .send({
        event: 'payment.completed',
        payload: { orderId: 'ORD1' },
      });

    expect(res.status).toBe(202);
    expect(res.body.deliveriesCreated).toBe(2);
  });

  it('no subscribers → returns 200 with zero deliveries', async () => {
    eventService.triggerEvent = vi.fn().mockResolvedValue({
      deliveriesCreated: 0,
      deliveryIds: [],
    });

    const res = await request(app)
      .post('/api/events/trigger')
      .send({
        event: 'unknown.event',
        payload: { x: 1 },
      });

    expect(res.status).toBe(200);
    expect(res.body.deliveriesCreated).toBe(0);
  });

  it('missing event → returns 400', async () => {
    const res = await request(app)
      .post('/api/events/trigger')
      .send({
        payload: { x: 1 },
      });

    expect(res.status).toBe(400);
  });

  it('missing payload → returns 400', async () => {
    const res = await request(app)
      .post('/api/events/trigger')
      .send({
        event: 'payment.completed',
      });

    expect(res.status).toBe(400);
  });

  it('invalid payload (not object) → returns 400', async () => {
    const res = await request(app)
      .post('/api/events/trigger')
      .send({
        event: 'payment.completed',
        payload: 'not-an-object',
      });

    expect(res.status).toBe(400);
  });
});

