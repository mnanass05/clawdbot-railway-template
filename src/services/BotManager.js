/**
 * Simple Bot Runner - Alternative à OpenClaw
 * Gère directement les APIs Telegram et OpenAI
 */

import { Bot } from '../models/Bot.js';

// Store conversations in memory (pourrait être en DB)
const conversations = new Map();

class SimpleBotRunner {
  constructor() {
    this.runningBots = new Map();
  }

  async startBot(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) throw new Error('Bot not found');

    const fullBot = await Bot.findByIdWithTokens(botId);
    if (!fullBot) throw new Error('Failed to get bot tokens');

    console.log(`[SimpleBotRunner] Starting bot ${botId} (${bot.name})`);

    // Configurer le webhook Telegram
    const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (!publicDomain) {
      throw new Error('RAILWAY_PUBLIC_DOMAIN not set');
    }

    const webhookUrl = `https://${publicDomain}/webhook/telegram/${botId}`;
    
    // Mettre à jour le statut
    await Bot.update(botId, { 
      status: 'running',
      webhook_url: webhookUrl
    });

    // Stocker les infos du bot
    this.runningBots.set(botId, {
      botId,
      token: fullBot.platformToken,
      openaiKey: fullBot.aiToken,
      model: bot.ai_model,
      systemPrompt: bot.system_prompt,
      startedAt: new Date()
    });

    // Configurer le webhook Telegram
    await this.setTelegramWebhook(fullBot.platformToken, webhookUrl);

    console.log(`[SimpleBotRunner] Bot ${botId} started with webhook: ${webhookUrl}`);
    return { success: true, webhookUrl };
  }

  async stopBot(botId) {
    const bot = this.runningBots.get(botId);
    if (bot) {
      // Supprimer le webhook Telegram
      await this.deleteTelegramWebhook(bot.token);
      this.runningBots.delete(botId);
    }

    await Bot.update(botId, { status: 'stopped', webhook_url: null });
    console.log(`[SimpleBotRunner] Bot ${botId} stopped`);
    return { success: true };
  }

  async setTelegramWebhook(token, url) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      console.log('[SimpleBotRunner] Webhook set:', data);
      return data;
    } catch (error) {
      console.error('[SimpleBotRunner] Failed to set webhook:', error);
      throw error;
    }
  }

  async deleteTelegramWebhook(token) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('[SimpleBotRunner] Failed to delete webhook:', error);
    }
  }

  // Gérer un message Telegram entrant
  async handleTelegramUpdate(botId, update) {
    const bot = this.runningBots.get(botId);
    if (!bot) {
      console.error(`[SimpleBotRunner] Bot ${botId} not running`);
      return;
    }

    if (!update.message) return;

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';
    const userName = message.from?.username || message.from?.first_name || 'User';

    console.log(`[${botId}] Message from ${userName}: ${text.substring(0, 50)}`);

    // Gérer les commandes
    if (text === '/start') {
      await this.sendTelegramMessage(bot.token, chatId, 
        `👋 Bonjour ${userName}!\n\nJe suis votre assistant IA. Comment puis-je vous aider ?`
      );
      return;
    }

    if (text === '/help') {
      await this.sendTelegramMessage(bot.token, chatId,
        `📚 Commandes:\n/start - Démarrer\n/help - Aide\nEnvoyez un message pour discuter avec l'IA.`
      );
      return;
    }

    // Récupérer l'historique
    const convKey = `${botId}-${chatId}`;
    if (!conversations.has(convKey)) {
      conversations.set(convKey, []);
    }
    const history = conversations.get(convKey);

    // Ajouter le message utilisateur
    history.push({ role: 'user', content: text });
    if (history.length > 10) history.shift();

    // Appeler OpenAI
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bot.openaiKey}`
        },
        body: JSON.stringify({
          model: bot.model || 'gpt-4o-mini',
          messages: [
            ...(bot.systemPrompt ? [{ role: 'system', content: bot.systemPrompt }] : []),
            ...history
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('[SimpleBotRunner] OpenAI error:', data.error);
        await this.sendTelegramMessage(bot.token, chatId, 
          "Désolé, je rencontre un problème. Réessayez plus tard."
        );
        return;
      }

      const aiResponse = data.choices?.[0]?.message?.content || "Je n'ai pas compris.";
      
      // Ajouter la réponse à l'historique
      history.push({ role: 'assistant', content: aiResponse });

      // Envoyer la réponse
      await this.sendTelegramMessage(bot.token, chatId, aiResponse);

      // Incrémenter le compteur de messages
      await Bot.incrementMessages(botId);

    } catch (error) {
      console.error('[SimpleBotRunner] Error:', error);
      await this.sendTelegramMessage(bot.token, chatId, 
        "Désolé, une erreur s'est produite."
      );
    }
  }

  async sendTelegramMessage(token, chatId, text) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (error) {
      console.error('[SimpleBotRunner] Failed to send message:', error);
    }
  }

  async getBotStatus(botId) {
    const bot = this.runningBots.get(botId);
    const dbBot = await Bot.findById(botId);
    if (!dbBot) return null;
    
    return {
      id: botId,
      status: bot ? 'running' : dbBot.status,
      port: null,
      pid: null,
      running: !!bot
    };
  }

  async restartBot(botId) {
    await this.stopBot(botId);
    await new Promise(r => setTimeout(r, 1000));
    return this.startBot(botId);
  }
}

export const simpleBotRunner = new SimpleBotRunner();
export default simpleBotRunner;
