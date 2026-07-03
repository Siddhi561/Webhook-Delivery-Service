import * as eventService from '../services/eventService.js';
import asyncHandler from '../middleware/asyncHandler.js';

// POST /api/events/trigger
export const triggerEvent = asyncHandler(async (req, res) => {
  const { event, payload } = req.body;

  const result = await eventService.triggerEvent({ event, payload });

  if (result.deliveriesCreated === 0) {
    return res.status(200).json({
      success: true,
      message: 'No webhooks subscribed to this event',
      deliveriesCreated: 0,
    });
  }

  res.status(202).json({
    success: true,
    message: `Event queued for ${result.deliveriesCreated} webhook(s)`,
    event,
    deliveriesCreated: result.deliveriesCreated,
    deliveryIds: result.deliveryIds,
  });
});