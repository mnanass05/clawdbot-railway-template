/**
 * Authentication Middleware
 * JWT verification and user attachment
 */

import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/constants.js';
import { User } from '../models/User.js';

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.[JWT_CONFIG.COOKIE_NAME];
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan_type,
      maxBots: user.max_bots
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Optional authentication - attach user if token exists
 */
export async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.[JWT_CONFIG.COOKIE_NAME];
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_CONFIG.SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan_type,
          maxBots: user.max_bots
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
}

/**
 * Require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user is admin (first user or admin email)
  const adminEmails = ['admin@openclaw.dev', process.env.ADMIN_EMAIL].filter(Boolean);
  
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

/**
 * Generate JWT token
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_CONFIG.SECRET, {
    expiresIn: JWT_CONFIG.EXPIRES_IN
  });
}

/**
 * Set auth cookie
 */
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie(JWT_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res) {
  res.clearCookie(JWT_CONFIG.COOKIE_NAME, { path: '/' });
}
