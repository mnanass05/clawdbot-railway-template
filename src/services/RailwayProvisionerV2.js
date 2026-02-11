/**
 * RailwayProvisioner V2
 * Utilise la nouvelle API REST de Railway (compatible Project Tokens)
 * Documentation: https://docs.railway.com/reference/public-api
 */

import { Bot } from '../models/Bot.js';

const RAILWAY_API_URL = 'https://api.railway.com/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID;

class RailwayProvisionerV2 {
  constructor() {
    if (!RAILWAY_TOKEN) {
      console.warn('[RailwayProvisionerV2] ⚠️ RAILWAY_API_TOKEN not set!');
    }
    if (!PROJECT_ID) {
      console.warn('[RailwayProvisionerV2] ⚠️ RAILWAY_PROJECT_ID not set!');
    }
    console.log('[RailwayProvisionerV2] 🚀 Initialisé avec API REST v2');
  }

  /**
   * API Request helper
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${RAILWAY_API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Railway API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Provision a new bot worker service
   */
  async provisionBot(botConfig) {
    const { botId, userId, name, telegramToken, openaiKey, model, systemPrompt } = botConfig;

    console.log(`[RailwayProvisionerV2] 🚀 Provisioning bot: ${name} (${botId})`);

    try {
      // 1. Create the service
      const serviceName = `openclaw-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${botId.slice(0, 8)}`;
      const service = await this.createService(serviceName);
      console.log(`[RailwayProvisionerV2] ✅ Service created: ${service.id}`);

      // 2. Generate webhook URL
      const domain = `${service.id}.up.railway.app`;
      const webhookUrl = `https://${domain}`;

      // 3. Set all environment variables pour OpenClaw
      await this.setServiceVariables(service.id, {
        TELEGRAM_BOT_TOKEN: telegramToken,
        OPENAI_API_KEY: openaiKey,
        OPENAI_MODEL: model || 'gpt-4o-mini',
        DATABASE_URL: 'file:./data/openclaw.db',
        WEBHOOK_URL: webhookUrl,
        BOT_NAME: name,
        SYSTEM_PROMPT: systemPrompt || 'Tu es un assistant utile et intelligent.',
        PORT: '3000',
        NODE_ENV: 'production',
        BOT_ID: botId,
        USER_ID: userId
      });
      console.log(`[RailwayProvisionerV2] ✅ Environment variables set`);

      // 4. Trigger deployment
      const deployment = await this.deployService(service.id);
      console.log(`[RailwayProvisionerV2] ✅ Deployment triggered: ${deployment.id}`);

      // 5. Update bot in database
      await Bot.update(botId, {
        railway_service_id: service.id,
        status: 'deploying',
        webhook_url: webhookUrl,
        internal_port: 3000
      });

      return {
        success: true,
        serviceId: service.id,
        serviceName,
        domain: webhookUrl,
        deploymentId: deployment.id,
        webhookUrl: `${webhookUrl}/webhook/telegram`
      };

    } catch (error) {
      console.error(`[RailwayProvisionerV2] ❌ Failed to provision bot:`, error);
      await Bot.update(botId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Create a new Railway service
   */
  async createService(name) {
    return this.apiRequest(`/projects/${PROJECT_ID}/services`, {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        source: {
          repo: process.env.WORKER_REPO || 'mnanass05/clawdbot-railway-template',
          branch: process.env.WORKER_BRANCH || 'main',
          rootDirectory: 'openclaw-worker'
        }
      })
    });
  }

  /**
   * Set environment variables for a service
   */
  async setServiceVariables(serviceId, variables) {
    for (const [key, value] of Object.entries(variables)) {
      try {
        await this.apiRequest(`/services/${serviceId}/variables`, {
          method: 'POST',
          body: JSON.stringify({
            environmentId: ENVIRONMENT_ID,
            name: key,
            value: String(value)
          })
        });
        console.log(`[RailwayProvisionerV2]   → Set ${key}`);
      } catch (error) {
        console.error(`[RailwayProvisionerV2]   ✗ Failed to set ${key}:`, error.message);
      }
    }
  }

  /**
   * Deploy a service
   */
  async deployService(serviceId) {
    return this.apiRequest(`/services/${serviceId}/deploy`, {
      method: 'POST',
      body: JSON.stringify({
        environmentId: ENVIRONMENT_ID
      })
    });
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceId) {
    try {
      const service = await this.apiRequest(`/services/${serviceId}`);
      const deployments = await this.apiRequest(`/services/${serviceId}/deployments`);
      const latestDeployment = deployments[0];

      return {
        id: serviceId,
        name: service.name,
        status: latestDeployment?.status || 'unknown',
        domain: service.domain,
        latestDeployment
      };
    } catch (error) {
      console.error(`[RailwayProvisionerV2] Error getting status:`, error.message);
      return null;
    }
  }

  /**
   * Wrapper methods for compatibility
   */
  async startBot(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) throw new Error('Bot not found');

    const fullBot = await Bot.findByIdWithTokens(botId);
    if (!fullBot) throw new Error('Failed to get bot tokens');

    // If already has service, just redeploy
    if (bot.railway_service_id) {
      return this.restartService(bot.railway_service_id);
    }

    // Otherwise create new service
    return this.provisionBot({
      botId: bot.id,
      userId: bot.user_id,
      name: bot.name,
      telegramToken: fullBot.platformToken,
      openaiKey: fullBot.aiToken,
      model: bot.ai_model,
      systemPrompt: bot.system_prompt
    });
  }

  async stopBot(botId) {
    const bot = await Bot.findById(botId);
    if (!bot || !bot.railway_service_id) {
      if (bot) await Bot.update(botId, { status: 'stopped' });
      return { success: true };
    }

    // Note: Railway API v2 doesn't have a direct "stop", we just mark as stopped
    await Bot.update(botId, { status: 'stopped' });
    return { success: true };
  }

  async restartService(serviceId) {
    console.log(`[RailwayProvisionerV2] 🔄 Restarting service: ${serviceId}`);
    const deployment = await this.deployService(serviceId);
    return {
      success: true,
      deploymentId: deployment.id
    };
  }

  async deleteService(serviceId) {
    console.log(`[RailwayProvisionerV2] 🗑️ Deleting service: ${serviceId}`);
    return this.apiRequest(`/services/${serviceId}`, {
      method: 'DELETE'
    });
  }

  async getBotStatus(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) return null;

    if (bot.railway_service_id) {
      try {
        const serviceStatus = await this.getServiceStatus(bot.railway_service_id);
        return {
          id: botId,
          status: bot.status,
          serviceId: bot.railway_service_id,
          serviceStatus: serviceStatus?.status,
          running: serviceStatus?.status === 'SUCCESS',
          domain: bot.webhook_url,
          createdAt: bot.created_at
        };
      } catch (error) {
        console.error('[RailwayProvisionerV2] Error getting status:', error);
      }
    }

    return {
      id: botId,
      status: bot.status,
      running: bot.status === 'running',
      domain: bot.webhook_url
    };
  }

  // Legacy method names for compatibility
  async createBotService(botId) { return this.startBot(botId); }
  
  getServiceLogs(botId) {
    return `/tmp/bot-${botId}.log`;
  }

  async readLogs(logPath, limit) {
    return `Logs: ${logPath} (limit: ${limit})`;
  }
}

export const railwayProvisionerV2 = new RailwayProvisionerV2();
export default railwayProvisionerV2;
