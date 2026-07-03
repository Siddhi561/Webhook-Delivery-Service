import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z.string().url('Invalid URL format'),
  secret: z.string().min(8, 'Secret must be at least 8 characters'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  description: z.string().optional(),
});

export const triggerEventSchema = z.object({
  event: z.string().min(1, 'Event name is required'),
  payload: z.object({}).passthrough(), // accepts any object — Zod v4 compatible
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const err = new Error('Validation failed');
    err.name = 'ZodError';
    err.issues = result.error.issues;
    return next(err);
  }

  req.body = result.data;
  next();
};

export default validate;