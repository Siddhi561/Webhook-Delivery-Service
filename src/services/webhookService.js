import Webhook from '../models/webhook.js';
import Delivery from '../models/delivery.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';

// register a new webhook
export const createWebhook = async ({ url, secret, events, description }) => {
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

  const webhook = await Webhook.create({
    url,
    secret: webhookSecret,
    events,
    description,
  });

  logger.info('Webhook registered', { webhookId: webhook._id, url, events });

  // return secret only at creation — never again
  return {
    id: webhook._id,
    url: webhook.url,
    events: webhook.events,
    description: webhook.description,
    secret: webhookSecret,
    createdAt: webhook.createdAt,
  };
};

// get all webhooks
export const listWebhooks = async () => {
  const webhooks = await Webhook.find().select('-secret');
  return webhooks;
};

// get one webhook by id
export const getWebhookById = async (id) => {
  const webhook = await Webhook.findById(id).select('-secret');
  if (!webhook) {
    const err = new Error('Webhook not found');
    err.statusCode = 404;
    throw err;
  }
  return webhook;
};

// soft delete — sets isActive to false, keeps history
export const deactivateWebhook = async (id) => {
  const webhook = await Webhook.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!webhook) {
    const err = new Error('Webhook not found');
    err.statusCode = 404;
    throw err;
  }

  logger.info('Webhook deactivated', { webhookId: webhook._id });
  return { id: webhook._id, isActive: webhook.isActive };
};

// paginated delivery history for a webhook
export const getDeliveryHistory = async (webhookId, { status, page = 1, limit = 20 }) => {
  const filter = { webhookId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  
  const [deliveries, total] = await Promise.all([
    Delivery.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-payload'), 
    Delivery.countDocuments(filter),
  ]);

  return {
    deliveries,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

export const getAllDeliveries = async ({ status }) => {
  const filter = status ? { status } : {};

  const deliveries = await Delivery.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .select('-payload');

  return deliveries;
};