/**
 * Application Constants
 */

// Plan configurations
export const PLANS = {
  FREE: {
    name: 'free',
    displayName: 'Free',
    maxBots: parseInt(process.env.MAX_BOTS_PER_USER_FREE) || 1,
    maxMessages: 100,
    features: ['telegram', 'basic_models'],
    price: 0
  },
  PRO: {
    name: 'pro',
    displayName: 'Pro',
    maxBots: parseInt(process.env.MAX_BOTS_PER_USER_PRO) || 3,
    maxMessages: -1, // unlimited
    features: ['telegram', 'discord', 'slack', 'all_models', 'priority'],
    price: 9
  },
  BUSINESS: {
    name: 'business',
    displayName: 'Business',
    maxBots: parseInt(process.env.MAX_BOTS_PER_USER_BUSINESS) || 10,
    maxMessages: -1,
    features: ['telegram', 'discord', 'slack', 'all_models', 'priority', 'api_access', 'dedicated'],
    price: 29
  }
};

// Bot statuses
export const BOT_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
  SLEEPING: 'sleeping',
  DEPLOYING: 'deploying'
};

// Platforms
export const PLATFORMS = {
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  SLACK: 'slack'
};

// AI Providers
export const AI_PROVIDERS = {
  OPENAI: {
    name: 'openai',
    displayName: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o'
  },
  ANTHROPIC: {
    name: 'anthropic',
    displayName: 'Anthropic',
    models: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
    defaultModel: 'claude-3-5-sonnet-latest'
  },
  OPENROUTER: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
    defaultModel: 'openai/gpt-4o'
  }
};

// Port allocation
export const PORT_CONFIG = {
  START: parseInt(process.env.BOT_PORT_START) || 9000,
  END: parseInt(process.env.BOT_PORT_END) || 9999
};

// Rate limiting
export const RATE_LIMITS = {
  FREE: 100,      // requests per 15 min
  PRO: 1000,
  BUSINESS: 5000
};

// JWT Configuration
export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_NAME: 'auth_token'
};

// Encryption
export const ENCRYPTION = {
  KEY: process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!',
  ALGORITHM: 'aes-256-gcm'
};

// File paths
const isDev = process.env.NODE_ENV !== 'production';
export const PATHS = {
  DATA_DIR: process.env.DATA_DIR || (isDev ? './data' : '/data'),
  BOTS_DIR: process.env.BOTS_DIR || (isDev ? './data/bots' : '/data/bots'),
  SHARED_OPENCLAW: process.env.SHARED_OPENCLAW || (isDev ? './data/shared/openclaw' : '/data/shared/openclaw'),
  LOGS_DIR: process.env.LOGS_DIR || (isDev ? './data/logs' : '/data/logs')
};

// Resource limits
export const RESOURCE_LIMITS = {
  MAX_BOTS_TOTAL: parseInt(process.env.MAX_BOTS_TOTAL) || 50,
  BOT_IDLE_TIMEOUT_MS: parseInt(process.env.BOT_IDLE_TIMEOUT_MS) || 3600000, // 1 hour
  MAX_MEMORY_MB: 512,
  MAX_CPU_PERCENT: 80
};
