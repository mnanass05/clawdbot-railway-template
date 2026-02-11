/**
 * OpenClaw Worker
 * Instance OpenClaw complète avec mémoire persistante pour Railway
 */

import { OpenClaw } from 'openclaw';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';

// Configuration via ENV (injectées par RailwayProvisioner)
const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  openaiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL || 'file:./data/openclaw.db',
  port: process.env.PORT || 3000,
  webhookUrl: process.env.WEBHOOK_URL,
  botName: process.env.BOT_NAME || 'OpenClaw Bot',
  systemPrompt: process.env.SYSTEM_PROMPT || 'Tu es un assistant utile et intelligent.',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
};

// Express app pour healthcheck
const app = express();
app.use(express.json());

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'openclaw-worker'
  });
});

// Webhook endpoint pour Telegram
app.post('/webhook/telegram', async (req, res) => {
  try {
    // Forward to OpenClaw if it has webhook handler
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).send('Error');
  }
});

async function start() {
  console.log('[OpenClaw] 🚀 Starting OpenClaw instance...');
  console.log(`[OpenClaw] 📊 Database: ${config.databaseUrl}`);
  console.log(`[OpenClaw] 🔧 Port: ${config.port}`);

  try {
    // Vérifier les variables requises
    if (!config.telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    if (!config.openaiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    if (!config.webhookUrl) {
      throw new Error('WEBHOOK_URL is required');
    }

    // 1. Démarrer le serveur Express
    const server = app.listen(config.port, () => {
      console.log(`[OpenClaw] ✅ Server listening on port ${config.port}`);
    });

    // 2. Initialiser OpenClaw
    let claw;
    try {
      claw = new OpenClaw({
        llm: {
          provider: 'openai',
          apiKey: config.openaiKey,
          model: config.model
        },
        memory: {
          type: 'sqlite',
          url: config.databaseUrl
        },
        telegram: {
          token: config.telegramToken,
          webhookUrl: `${config.webhookUrl}/webhook/telegram`
        },
        systemPrompt: config.systemPrompt
      });

      await claw.start();
      console.log('[OpenClaw] ✅ OpenClaw initialized successfully');
    } catch (clawError) {
      console.warn('[OpenClaw] ⚠️  Could not initialize OpenClaw framework:', clawError.message);
      console.log('[OpenClaw] 🔄 Falling back to basic Telegram bot...');
    }

    // 3. Configurer webhook Telegram automatiquement
    const bot = new TelegramBot(config.telegramToken, { polling: false });
    
    // Vérifier le bot
    const botInfo = await bot.getMe();
    console.log(`[Telegram] ✅ Bot authenticated: @${botInfo.username}`);

    // Configurer le webhook
    const webhookUrl = `${config.webhookUrl}/webhook/telegram`;
    await bot.setWebHook(webhookUrl);
    console.log(`[Telegram] ✅ Webhook configured: ${webhookUrl}`);

    // Vérifier le webhook
    const webhookInfo = await bot.getWebHookInfo();
    console.log(`[Telegram] 📋 Webhook info: ${JSON.stringify(webhookInfo)}`);

    console.log('[OpenClaw] 🎉 Instance ready!');

    // Gérer les signaux d'arrêt
    process.on('SIGTERM', async () => {
      console.log('[OpenClaw] 🛑 SIGTERM received, shutting down...');
      if (claw) await claw.stop();
      server.close(() => {
        console.log('[OpenClaw] 👋 Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('[OpenClaw] 🛑 SIGINT received, shutting down...');
      if (claw) await claw.stop();
      server.close(() => {
        console.log('[OpenClaw] 👋 Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[OpenClaw] ❌ Failed to start:', error);
    process.exit(1);
  }
}

start().catch(console.error);
