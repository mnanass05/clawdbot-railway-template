/**
 * Rate Limiting Middleware
 * Prevents API abuse
 */

import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/constants.js';

// Store for rate limit data (in production, use Redis)
const requestStore = new Map();

/**
 * Create rate limiter based on user plan
 */
export function createRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      // Get limit based on user plan
      if (req.user) {
        return RATE_LIMITS[req.user.plan?.toUpperCase()] || RATE_LIMITS.FREE;
      }
      return RATE_LIMITS.FREE;
    },
    message: {
      error: 'Too many requests, please try again later',
      retryAfter: 900 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Custom key generator
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    // Skip successful requests for certain routes
    skip: (req) => {
      // Don't rate limit health checks
      return req.path === '/health';
    }
  });
}

/**
 * Stricter rate limiter for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Rate limiter for bot creation
 */
export const botCreationLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 bots per hour max
  message: {
    error: 'Bot creation limit reached, please try again later'
  }
});

/**
 * Webhook rate limiter (per bot)
 */
export function webhookRateLimit(botId, maxRequests = 100) {
  const key = `webhook:${botId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  if (!requestStore.has(key)) {
    requestStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  
  const data = requestStore.get(key);
  
  // Reset if window expired
  if (now > data.resetTime) {
    requestStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  
  // Check limit
  if (data.count >= maxRequests) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    };
  }
  
  // Increment count
  data.count++;
  return { allowed: true };
}

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestStore.entries()) {
    if (now > data.resetTime) {
      requestStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export default createRateLimiter;
