import {Router} from 'express';
import validate from '../middleware/validate.js';
import { triggerEventSchema} from '../middleware/validate.js';
import {
    triggerEvent
} from '../controllers/event.controller.js';

const router = Router();

router.post('/trigger', validate(triggerEventSchema), triggerEvent);

export default router;