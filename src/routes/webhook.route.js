import { Router } from 'express';
import validate from '../middleware/validate.js';
import { createWebhookSchema } from '../middleware/validate.js';
import {
    registerWebhook,
    getAllWebhooks,
    deactivateWebhook,
    getDeliveries,
    getAllDeliveries,
} from '../controllers/webhook.controller.js';

const router = Router();

router.post('/create', validate(createWebhookSchema), registerWebhook);
router.get('/all-deliveries', getAllDeliveries );
router.get('/', getAllWebhooks);
router.delete('/delete/:id', deactivateWebhook);
router.get('/:id/deliveries', getDeliveries);


export default router;
