/**
 * Bot Routes
 * /api/bots/*
 */

import { Router } from 'express';
import botController from '../controllers/botController.js';
import { authenticate } from '../middleware/auth.js';
import { botCreationLimit } from '../middleware/rateLimit.js';

const router = Router();

// All bot routes require authentication
router.use(authenticate);

// Bot CRUD
router.get('/', botController.listBots);
router.post('/', botCreationLimit, botController.createBot);
router.get('/providers', botController.getProviders);
router.get('/:id', botController.getBot);
router.put('/:id', botController.updateBot);
router.delete('/:id', botController.deleteBot);

// Bot operations
router.post('/:id/start', botController.startBot);
router.post('/:id/stop', botController.stopBot);
router.post('/:id/restart', botController.restartBot);
router.get('/:id/status', botController.getBotStatus);
router.get('/:id/logs', botController.getBotLogs);

export default router;
