import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
import Webhook from '../models/webhook.js';
import Delivery from '../models/delivery.js';

const connect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('MongoDB connected');
};

const disconnect = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

// ── seed data ─────────────────────────────────────────────────────────────────

const webhooks = [
  {
    url: 'https://webhook.site/demo-endpoint-1',
    secret: crypto.randomBytes(16).toString('hex'),
    events: ['payment.completed', 'refund.issued'],
    description: 'Payment service — production',
    isActive: true,
  },
  {
    url: 'https://webhook.site/demo-endpoint-2',
    secret: crypto.randomBytes(16).toString('hex'),
    events: ['user.created', 'subscription.cancelled'],
    description: 'User service — staging',
    isActive: false,
  },
];

const makeDeliveries = (webhookDocs) => [
  {
    webhookId: webhookDocs[0]._id,
    event: 'payment.completed',
    payload: { orderId: 'ORD001', amount: 1500, currency: 'INR', status: 'success' },
    status: 'success',
    attempts: 1,
    responseStatus: 200,
    responseBody: '{"received":true}',
    completedAt: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
  },
  {
    webhookId: webhookDocs[0]._id,
    event: 'payment.completed',
    payload: { orderId: 'ORD002', amount: 800, currency: 'INR', status: 'success' },
    status: 'failed',
    attempts: 5,
    responseStatus: 503,
    responseBody: 'Service Unavailable',
    errorMessage: 'Delivery failed with status 503',
    completedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
  },
  {
    webhookId: webhookDocs[0]._id,
    event: 'refund.issued',
    payload: { refundId: 'REF001', orderId: 'ORD001', amount: 500, reason: 'Customer request' },
    status: 'success',
    attempts: 2,
    responseStatus: 200,
    responseBody: '{"status":"ok"}',
    completedAt: new Date(Date.now() - 1000 * 60 * 10), // 10 mins ago
  },
  {
    webhookId: webhookDocs[0]._id,
    event: 'payment.completed',
    payload: { orderId: 'ORD003', amount: 2200, currency: 'INR', status: 'success' },
    status: 'pending',
    attempts: 2,
    responseStatus: 500,
    responseBody: 'Internal Server Error',
    nextRetryAt: new Date(Date.now() + 1000 * 25), // next retry in 25s
  },
  {
    webhookId: webhookDocs[1]._id,
    event: 'user.created',
    payload: { userId: 'USR001', email: 'demo@example.com', plan: 'pro' },
    status: 'success',
    attempts: 1,
    responseStatus: 201,
    responseBody: '{"created":true}',
    completedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  },
  {
    webhookId: webhookDocs[1]._id,
    event: 'subscription.cancelled',
    payload: { userId: 'USR002', plan: 'pro', reason: 'Too expensive' },
    status: 'failed',
    attempts: 5,
    errorMessage: 'connect ECONNREFUSED — target server unreachable',
    completedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
  },
];

// ── commands ──────────────────────────────────────────────────────────────────

const seed = async () => {
  await connect();

  // check if already seeded
  const existing = await Webhook.countDocuments();
  if (existing > 0) {
    logger.warn('Database already has data. Run npm run seed:clear first.');
    await disconnect();
    process.exit(0);
  }

  const webhookDocs = await Webhook.insertMany(webhooks);
  logger.info(`Inserted ${webhookDocs.length} webhooks`);

  const deliveries = makeDeliveries(webhookDocs);
  const deliveryDocs = await Delivery.insertMany(deliveries);
  logger.info(`Inserted ${deliveryDocs.length} deliveries`);

  logger.info('Seed complete');
  logger.info(`Active webhook ID: ${webhookDocs[0]._id}`);
  logger.info(`Inactive webhook ID: ${webhookDocs[1]._id}`);

  await disconnect();
};

const clear = async () => {
  await connect();

  const wh = await Webhook.deleteMany({});
  const dl = await Delivery.deleteMany({});

  logger.info(`Cleared ${wh.deletedCount} webhooks and ${dl.deletedCount} deliveries`);
  await disconnect();
};

// ── entry point ───────────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === 'clear') {
  clear().catch((err) => {
    logger.error('Seed clear failed', { error: err.message });
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  });
}