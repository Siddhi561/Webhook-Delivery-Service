import * as webhookService from '../services/webhookService.js';
import asyncHandler from '../middleware/asyncHandler.js';

// POST /api/webhooks/create
export const registerWebhook = asyncHandler(async (req, res) => {
  const data = await webhookService.createWebhook(req.body);

  res.status(201).json({ success: true, data });
});

// GET /api/webhooks
export const getAllWebhooks = asyncHandler(async (req, res) => {
  const data = await webhookService.listWebhooks();

  res.status(200).json({ success: true, data });
});

// DELETE /api/webhooks/delete/:id
export const deactivateWebhook = asyncHandler(async (req, res) => {
  const data = await webhookService.deactivateWebhook(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Webhook deactivated',
    data,
  });
});

// GET /api/webhooks/:id/deliveries
export const getDeliveries = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;

  const result = await webhookService.getDeliveryHistory(
    req.params.id,
    { status, page, limit }
  );

  res.status(200).json({ success: true, ...result });
});



export const getAllDeliveries = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const data = await webhookService.getAllDeliveries({ status });

  res.status(200).json({ success: true, data });
});