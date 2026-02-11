/**
 * Bot Controller
 * Handles bot CRUD operations and lifecycle management
 */

import Joi from 'joi';
import { Bot } from '../models/Bot.js';
import { User } from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { PLATFORMS, AI_PROVIDERS } from '../config/constants.js';
import railwayProvisioner from '../services/RailwayProvisioner.js';
import mockProvisioner from '../services/MockProvisioner.js';

// Utiliser mockProvisioner par défaut (fonctionne sans Railway API)
// Quand Railway sera configuré correctement, on pourra switch
const provisioner = mockProvisioner;
console.log('[BotController] Mode: Mock (déploiement manuel requis)');

// Validation schema for bot creation
const createBotSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  platform: Joi.string().valid(...Object.values(PLATFORMS)).required(),
  platformToken: Joi.string().required(),
  aiProvider: Joi.string().valid(...Object.keys(AI_PROVIDERS)).required(),
  aiToken: Joi.string().required(),
  aiModel: Joi.string().optional(),
  systemPrompt: Joi.string().max(2000).optional().allow('')
});

/**
 * List user's bots
 * GET /api/bots
 */
export const listBots = asyncHandler(async (req, res) => {
  const bots = await Bot.findByUser(req.user.id);

  // Enhance with runtime status from provisioner (ignore errors)
  const enhancedBots = await Promise.all(bots.map(async (bot) => {
    try {
      const runtimeStatus = await provisioner.getBotStatus(bot.id);
      return { ...bot, runtime: runtimeStatus || null };
    } catch (err) {
      // Provisioner not configured, return bot without runtime info
      return { ...bot, runtime: null };
    }
  }));

  res.json({ bots: enhancedBots });
});

/**
 * Get bot by ID
 * GET /api/bots/:id
 */
export const getBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  // Add runtime status
  const runtimeStatus = await provisioner.getBotStatus(bot.id);

  res.json({
    bot: {
      ...bot,
      runtime: runtimeStatus
    }
  });
});

/**
 * Create new bot
 * POST /api/bots
 */
export const createBot = asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = createBotSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Check bot limit
  const userBotCount = await Bot.countByUser(req.user.id);
  if (userBotCount >= req.user.maxBots) {
    throw new AppError(
      `Bot limit reached (${req.user.maxBots}). Upgrade your plan to create more bots.`,
      403
    );
  }

  // Get default model if not specified
  const aiModel = value.aiModel || AI_PROVIDERS[value.aiProvider.toUpperCase()]?.defaultModel || 'gpt-4o';

  // Create bot
  const bot = await Bot.create({
    userId: req.user.id,
    name: value.name,
    platform: value.platform,
    platformToken: value.platformToken,
    aiProvider: value.aiProvider,
    aiToken: value.aiToken,
    aiModel,
    systemPrompt: value.systemPrompt
  });

  // Try to start the bot on Railway (async, don't wait)
  provisioner.startBot(bot.id).catch(err => {
    console.error(`[BotController] Failed to start bot ${bot.id}:`, err.message);
    // Bot is created in DB but deployment failed - user can retry later
  });

  res.status(201).json({
    message: 'Bot created successfully. Deployment will start shortly.',
    bot
  });
});

/**
 * Update bot
 * PUT /api/bots/:id
 */
export const updateBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  const schema = Joi.object({
    name: Joi.string().min(3).max(50).optional(),
    aiModel: Joi.string().optional(),
    aiToken: Joi.string().optional(),
    aiProvider: Joi.string().valid(...Object.keys(AI_PROVIDERS)).optional(),
    systemPrompt: Joi.string().max(2000).optional().allow(''),
    config: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const updates = {};
  if (value.name) updates.name = value.name;
  if (value.aiModel) updates.ai_model = value.aiModel;
  if (value.aiToken) updates.ai_token = value.aiToken;
  if (value.aiProvider) updates.ai_provider = value.aiProvider.toUpperCase();
  if (value.systemPrompt !== undefined) updates.system_prompt = value.systemPrompt;
  if (value.config) updates.config_json = value.config;

  const updated = await Bot.update(req.params.id, updates);

  // If AI config changed and bot is running, restart it to apply new config
  const needsRestart = (value.aiToken || value.aiProvider || value.aiModel) && bot.status === 'running';
  if (needsRestart) {
    console.log(`[BotController] AI config changed for bot ${bot.id}, restarting...`);
    try {
      await provisioner.stopBot(bot.id);
      await new Promise(r => setTimeout(r, 1000));
      await provisioner.startBot(bot.id);
    } catch (err) {
      console.error(`[BotController] Failed to restart bot after AI config change:`, err);
    }
  }

  res.json({
    message: needsRestart ? 'Bot updated and restarted with new AI config' : 'Bot updated',
    bot: await Bot.findById(req.params.id)
  });
});

/**
 * Delete bot
 * DELETE /api/bots/:id
 */
export const deleteBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  // Stop bot if running
  if (bot.status === 'running' || bot.railway_service_id) {
    try {
      await provisioner.stopBot(bot.id);
      if (bot.railway_service_id) {
        await provisioner.deleteService(bot.railway_service_id);
      }
    } catch (err) {
      console.error(`Failed to stop/delete bot ${bot.id} service before database delete:`, err);
    }
  }

  await Bot.delete(req.params.id);

  res.json({ message: 'Bot deleted successfully' });
});

/**
 * Get bot logs
 * GET /api/bots/:id/logs
 */
export const getBotLogs = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  const { limit = 100 } = req.query;

  // Read log file if exists
  try {
    const logPath = provisioner.getServiceLogs(bot.id);
    const logs = await provisioner.readLogs(logPath, parseInt(limit));
    res.json({ logs });
  } catch {
    res.json({ logs: [] });
  }
});

/**
 * Get available providers and models
 * GET /api/bots/providers
 */
export const getProviders = asyncHandler(async (req, res) => {
  res.json({
    platforms: Object.values(PLATFORMS),
    aiProviders: AI_PROVIDERS
  });
});

/**
 * Start bot
 * POST /api/bots/:id/start
 */
export const startBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  if (bot.status === 'running') {
    throw new AppError('Bot is already running', 400);
  }

  try {
    const result = await provisioner.startBot(bot.id);

    res.json({
      message: 'Bot started successfully',
      bot: await Bot.findById(bot.id),
      runtime: result
    });
  } catch (error) {
    console.error(`Failed to start bot ${bot.id}:`, error);
    throw new AppError(`Failed to start bot: ${error.message}`, 500);
  }
});

/**
 * Stop bot
 * POST /api/bots/:id/stop
 */
export const stopBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  if (bot.status !== 'running') {
    throw new AppError('Bot is not running', 400);
  }

  try {
    await provisioner.stopBot(bot.id);

    res.json({
      message: 'Bot stopped successfully',
      bot: await Bot.findById(bot.id)
    });
  } catch (error) {
    console.error(`Failed to stop bot ${bot.id}:`, error);
    throw new AppError(`Failed to stop bot: ${error.message}`, 500);
  }
});

/**
 * Restart bot
 * POST /api/bots/:id/restart
 */
export const restartBot = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  try {
    const result = await provisioner.restartService(bot.id);

    res.json({
      message: 'Bot restarted successfully',
      bot: await Bot.findById(bot.id),
      runtime: {
        port: result.port,
        pid: result.pid
      }
    });
  } catch (error) {
    console.error(`Failed to restart bot ${bot.id}:`, error);
    throw new AppError(`Failed to restart bot: ${error.message}`, 500);
  }
});

/**
 * Get bot status
 * GET /api/bots/:id/status
 */
export const getBotStatus = asyncHandler(async (req, res) => {
  const bot = await Bot.findById(req.params.id);

  if (!bot || bot.user_id !== req.user.id) {
    throw new AppError('Bot not found', 404);
  }

  const status = await provisioner.getBotStatus(bot.id);

  res.json({ status });
});

export default {
  listBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  getBotLogs,
  getProviders,
  startBot,
  stopBot,
  restartBot,
  getBotStatus
};
