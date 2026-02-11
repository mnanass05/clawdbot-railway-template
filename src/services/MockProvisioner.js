/**
 * Mock Provisioner
 * Utilisé quand Railway n'est pas configuré ou ne fonctionne pas
 * Les bots sont créés en DB mais pas déployés automatiquement
 */

import { Bot } from '../models/Bot.js';

class MockProvisioner {
  constructor() {
    console.log('[MockProvisioner] Mode sans Railway activé');
  }

  async provisionBot(botConfig) {
    console.log(`[MockProvisioner] Bot ${botConfig.botId} créé en DB (pas de déploiement auto)`);
    
    return {
      success: true,
      serviceId: 'mock-service',
      serviceName: `bot-${botConfig.botId}`,
      domain: null,
      deploymentId: null,
      webhookUrl: null,
      message: 'Bot créé en base de données. Déploiement manuel requis.'
    };
  }

  async startBot(botId) {
    console.log(`[MockProvisioner] Démarrage du bot ${botId} (mode manuel)`);
    
    const bot = await Bot.findById(botId);
    if (!bot) throw new Error('Bot not found');

    // Mettre à jour le statut
    await Bot.update(botId, { 
      status: 'stopped',
      webhook_url: null
    });

    return {
      success: true,
      serviceId: null,
      serviceName: `bot-${botId}`,
      domain: null,
      deploymentId: null,
      message: 'Bot prêt. Configurez le webhook Telegram manuellement ou déployez sur Railway.'
    };
  }

  async stopBot(botId) {
    console.log(`[MockProvisioner] Arrêt du bot ${botId}`);
    await Bot.update(botId, { status: 'stopped' });
    return { success: true };
  }

  async getBotStatus(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) return null;

    return {
      id: botId,
      status: bot.status,
      serviceId: bot.railway_service_id,
      serviceStatus: bot.status === 'running' ? 'SUCCESS' : 'STOPPED',
      running: bot.status === 'running',
      domain: bot.webhook_url,
      message: bot.railway_service_id ? 'Déployé sur Railway' : 'Mode manuel - déploiement requis'
    };
  }

  async restartService(botId) {
    return this.startBot(botId);
  }

  getServiceLogs(botId) {
    return `Logs: Mode manuel - pas de logs Railway pour le bot ${botId}`;
  }

  async readLogs(logPath, limit) {
    return `Mode manuel - logs non disponibles`;
  }
}

export const mockProvisioner = new MockProvisioner();
export default mockProvisioner;
