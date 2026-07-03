import Webhook from '../models/webhook.js';
import Delivery from '../models/delivery.js';
import { addDeliveryJob } from '../queues/webhookQueue.js';
import { logger } from '../config/logger.js';

export const triggerEvent = async ({ event, payload }) => {
  // find all active webhooks subscribed to this event
  const webhooks = await Webhook.find({
    isActive: true,
    events: event,
  });

  if (webhooks.length === 0) {
    return { deliveriesCreated: 0, deliveryIds: [] };
  }

  logger.info('Event triggered', { event, subscriberCount: webhooks.length });

  // create one delivery job per webhook independently
  const deliveryPromises = webhooks.map(async (webhook) => {
    // always write to DB first before queuing
    const delivery = await Delivery.create({
      webhookId: webhook._id,
      event,
      payload,
      status: 'pending',
    });

    await addDeliveryJob({
      webhookId: String(webhook._id),
      deliveryId: String(delivery._id),
      url: webhook.url,
      secret: webhook.secret,
      event,
      payload,
    });

    return delivery._id;
  });

  const deliveryIds = await Promise.all(deliveryPromises);

  logger.info('Deliveries queued', { event, count: deliveryIds.length });

  return { deliveriesCreated: deliveryIds.length, deliveryIds };
};