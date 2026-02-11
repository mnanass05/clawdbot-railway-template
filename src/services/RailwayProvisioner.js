/**
 * RailwayProvisioner
 * Crée des services Railway dynamiquement pour chaque bot OpenClaw
 * Architecture: 1 Bot = 1 Service Railway avec OpenClaw complet
 * 
 * OpenClaw Worker: Utilise le dossier openclaw-worker/ du repository
 * avec persistance SQLite pour la mémoire de l'agent IA
 */

import { Bot } from '../models/Bot.js';

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID;

// Configuration du repository pour le worker OpenClaw
const WORKER_REPO = process.env.WORKER_REPO || 'mnanass05/clawdbot-railway-template';
const WORKER_BRANCH = process.env.WORKER_BRANCH || 'main';
const WORKER_ROOT_DIR = 'openclaw-worker'; // CRITIQUE: Pointe vers le sous-dossier openclaw-worker

class RailwayProvisioner {
  constructor() {
    if (!RAILWAY_TOKEN) {
      console.error('[RailwayProvisioner] ❌ RAILWAY_API_TOKEN not set!');
    }
    if (!PROJECT_ID) {
      console.error('[RailwayProvisioner] ❌ RAILWAY_PROJECT_ID not set!');
    }
  }

  /**
   * Execute GraphQL query against Railway API
   */
  async graphqlQuery(query, variables = {}) {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Railway API HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors.map(e => e.message).join(', '));
    }

    return data.data;
  }

  /**
   * Provision a new OpenClaw bot service
   * Crée un service Railway avec OpenClaw complet (mémoire persistante SQLite)
   */
  async provisionBot(botConfig) {
    const { botId, userId, name, telegramToken, openaiKey, model, systemPrompt } = botConfig;

    console.log(`[RailwayProvisioner] 🚀 Provisioning OpenClaw bot: ${name} (${botId})`);

    try {
      // 1. Create the OpenClaw service pointing to openclaw-worker folder
      const serviceName = `openclaw-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${botId.slice(0, 8)}`;
      const service = await this.createOpenClawService(serviceName);
      console.log(`[RailwayProvisioner] ✅ OpenClaw service created: ${service.id}`);

      // 2. Generate webhook URL
      const serviceDomain = await this.getServiceDomain(service.id);
      const webhookUrl = `https://${serviceDomain}`;

      // 3. Set all environment variables pour OpenClaw
      await this.setServiceVariables(service.id, {
        // OpenClaw Configuration
        TELEGRAM_BOT_TOKEN: telegramToken,
        OPENAI_API_KEY: openaiKey,
        OPENAI_MODEL: model || 'gpt-4o-mini',
        DATABASE_URL: 'file:./data/openclaw.db', // SQLite persistant via volume
        WEBHOOK_URL: webhookUrl,
        BOT_NAME: name,
        SYSTEM_PROMPT: systemPrompt || 'Tu es un assistant utile et intelligent.',
        PORT: '3000',
        NODE_ENV: 'production',
        // Metadata
        BOT_ID: botId,
        USER_ID: userId
      });
      console.log(`[RailwayProvisioner] ✅ OpenClaw environment variables set`);

      // 4. Deploy the service
      const deployment = await this.deployService(service.id);
      console.log(`[RailwayProvisioner] ✅ Deployment triggered: ${deployment.id}`);

      // 5. Wait for deployment to be ready
      const domain = await this.waitForDeployment(service.id, deployment.id);
      console.log(`[RailwayProvisioner] ✅ OpenClaw service ready at: ${domain}`);

      // 6. Vérifier et configurer le webhook Telegram
      await this.configureTelegramWebhook(telegramToken, `${domain}/webhook/telegram`);

      // 7. Update bot in database
      await Bot.update(botId, {
        railway_service_id: service.id,
        status: 'running',
        webhook_url: domain,
        internal_port: 3000
      });

      return {
        success: true,
        serviceId: service.id,
        serviceName,
        domain,
        deploymentId: deployment.id,
        webhookUrl: `${domain}/webhook/telegram`
      };

    } catch (error) {
      console.error(`[RailwayProvisioner] ❌ Failed to provision OpenClaw bot:`, error);
      await Bot.update(botId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Create a new Railway service for OpenClaw
   * Pointe vers le dossier openclaw-worker du repository
   */
  async createOpenClawService(name) {
    const mutation = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
          projectId
          serviceDomains {
            domain
          }
        }
      }
    `;

    const result = await this.graphqlQuery(mutation, {
      input: {
        projectId: PROJECT_ID,
        name: name,
        source: {
          repo: WORKER_REPO,
          branch: WORKER_BRANCH,
          rootDirectory: WORKER_ROOT_DIR // CRITIQUE: C'est ce dossier qui sera buildé
        }
      }
    });

    return result.serviceCreate;
  }

  /**
   * Get service domain
   */
  async getServiceDomain(serviceId) {
    const query = `
      query Service($id: String!) {
        service(id: $id) {
          id
          serviceDomains {
            domain
          }
        }
      }
    `;

    const result = await this.graphqlQuery(query, { id: serviceId });
    const domains = result?.service?.serviceDomains;
    
    if (domains && domains.length > 0) {
      return domains[0].domain;
    }
    
    // Fallback: generate Railway domain
    return `${serviceId}.up.railway.app`;
  }

  /**
   * Configure Telegram webhook
   */
  async configureTelegramWebhook(token, webhookUrl) {
    try {
      // Vérifier le webhook actuel
      const checkResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const checkData = await checkResponse.json();
      
      console.log(`[RailwayProvisioner] 📋 Current webhook: ${JSON.stringify(checkData.result)}`);

      // Configurer le nouveau webhook
      const setResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query']
        })
      });

      const setData = await setResponse.json();
      
      if (setData.ok) {
        console.log(`[RailwayProvisioner] ✅ Telegram webhook configured: ${webhookUrl}`);
      } else {
        console.warn(`[RailwayProvisioner] ⚠️  Failed to set webhook: ${setData.description}`);
      }

      return setData.ok;
    } catch (error) {
      console.error(`[RailwayProvisioner] ❌ Error configuring webhook:`, error);
      return false;
    }
  }

  /**
   * Create a new Railway service (legacy method - kept for compatibility)
   * @deprecated Use createOpenClawService instead
   */
  async createService(name) {
    return this.createOpenClawService(name);
  }

  /**
   * Set environment variables for a service
   */
  async setServiceVariables(serviceId, variables) {
    // First, we need to get or create the environment
    const envMutation = `
      mutation VariableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input) {
          id
          name
          value
        }
      }
    `;

    for (const [name, value] of Object.entries(variables)) {
      try {
        await this.graphqlQuery(envMutation, {
          input: {
            projectId: PROJECT_ID,
            environmentId: ENVIRONMENT_ID,
            serviceId: serviceId,
            name: name,
            value: String(value)
          }
        });
        console.log(`[RailwayProvisioner]   → Set ${name}`);
      } catch (error) {
        console.error(`[RailwayProvisioner]   ✗ Failed to set ${name}:`, error.message);
      }
    }
  }

  /**
   * Deploy a service (create instance)
   */
  async deployService(serviceId) {
    const mutation = `
      mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) {
          id
          status
          createdAt
        }
      }
    `;

    const result = await this.graphqlQuery(mutation, {
      serviceId,
      environmentId: ENVIRONMENT_ID
    });

    return result.serviceInstanceDeploy;
  }

  /**
   * Wait for deployment to be ready and return domain
   */
  async waitForDeployment(serviceId, deploymentId, maxAttempts = 30) {
    console.log(`[RailwayProvisioner] ⏳ Waiting for deployment to be ready...`);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));

      try {
        // Get deployment status
        const query = `
          query Deployment($id: String!) {
            deployment(id: $id) {
              id
              status
              service {
                id
                domains {
                  edges {
                    node {
                      domain
                    }
                  }
                }
              }
            }
          }
        `;

        const result = await this.graphqlQuery(query, { id: deploymentId });
        const deployment = result?.deployment;

        if (deployment?.status === 'SUCCESS') {
          const domains = deployment.service?.domains?.edges || [];
          if (domains.length > 0) {
            return `https://${domains[0].node.domain}`;
          }
          // Fallback: generate Railway domain
          return `https://${serviceId}.up.railway.app`;
        }

        if (deployment?.status === 'FAILED') {
          throw new Error('Deployment failed');
        }

        process.stdout.write('.');
      } catch (error) {
        console.log(`[RailwayProvisioner] Retry ${i + 1}/${maxAttempts}...`);
      }
    }

    throw new Error('Deployment timeout');
  }

  /**
   * Stop a service (remove instance but keep service)
   */
  async stopService(serviceId) {
    console.log(`[RailwayProvisioner] 🛑 Stopping service: ${serviceId}`);

    try {
      // Get the bot to delete webhook
      const bot = await Bot.findByServiceId(serviceId);
      if (bot) {
        const fullBot = await Bot.findByIdWithTokens(bot.id);
        if (fullBot?.platformToken) {
          // Delete Telegram webhook
          await fetch(`https://api.telegram.org/bot${fullBot.platformToken}/deleteWebhook`, {
            method: 'POST'
          });
        }

        await Bot.update(bot.id, { status: 'stopped' });
      }

      // Note: Railway API doesn't have a direct "stop" - we'd need to 
      // either delete the service or scale to 0 (not directly supported via GraphQL)
      // For now, we just mark as stopped in DB

      return { success: true };
    } catch (error) {
      console.error('[RailwayProvisioner] Error stopping service:', error);
      throw error;
    }
  }

  /**
   * Delete a service completely
   */
  async deleteService(serviceId) {
    console.log(`[RailwayProvisioner] 🗑️ Deleting service: ${serviceId}`);

    const mutation = `
      mutation ServiceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;

    await this.graphqlQuery(mutation, { id: serviceId });
    return { success: true };
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceId) {
    const query = `
      query Service($id: String!) {
        service(id: $id) {
          id
          name
          deployments(last: 1) {
            edges {
              node {
                id
                status
                createdAt
              }
            }
          }
          instances(isDeleted: false) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }
    `;

    const result = await this.graphqlQuery(query, { id: serviceId });
    return result.service;
  }

  /**
   * Restart a service
   */
  async restartService(serviceId) {
    console.log(`[RailwayProvisioner] 🔄 Restarting service: ${serviceId}`);

    // Redeploy the service
    const deployment = await this.deployService(serviceId);
    const domain = await this.waitForDeployment(serviceId, deployment.id);

    return {
      success: true,
      deploymentId: deployment.id,
      domain
    };
  }

  // Wrapper methods for compatibility
  async startBot(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) throw new Error('Bot not found');

    const fullBot = await Bot.findByIdWithTokens(botId);
    if (!fullBot) throw new Error('Failed to get bot tokens');

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
      // Just mark as stopped in DB if no service exists
      if (bot) await Bot.update(botId, { status: 'stopped' });
      return { success: true };
    }
    return this.stopService(bot.railway_service_id);
  }

  async getBotStatus(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) return null;

    if (bot.railway_service_id) {
      try {
        const serviceStatus = await this.getServiceStatus(bot.railway_service_id);
        const latestDeployment = serviceStatus?.deployments?.edges?.[0]?.node;
        return {
          id: botId,
          status: bot.status,
          serviceId: bot.railway_service_id,
          serviceStatus: latestDeployment?.status,
          running: latestDeployment?.status === 'SUCCESS',
          domain: bot.webhook_url,
          createdAt: latestDeployment?.createdAt
        };
      } catch (error) {
        console.error('[RailwayProvisioner] Error getting status:', error);
      }
    }

    return {
      id: botId,
      status: bot.status,
      running: bot.status === 'running',
      domain: bot.webhook_url
    };
  }

  // Legacy method names for compatibility if needed
  async createBotService(botId) { return this.startBot(botId); }

  // Placeholder for log methods
  getServiceLogs(botId) {
    return `/tmp/bot-${botId}.log`;
  }

  async readLogs(logPath, limit) {
    return `Logs: ${logPath} (limit: ${limit})`;
  }
}

export const railwayProvisioner = new RailwayProvisioner();
export default railwayProvisioner;
