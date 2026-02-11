/**
 * Authentication Routes
 * /api/auth/*
 */

import { Router } from 'express';
import authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { User } from '../models/User.js';
import { query } from '../config/database.js';

const router = Router();

// Public routes
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/password', authenticate, authController.changePassword);

// Route temporaire pour créer l'utilisateur test (à retirer en production)
router.post('/setup-test-user', async (req, res) => {
  try {
    const bcrypt = await import('bcryptjs');
    
    // Vérifier si l'utilisateur existe
    const existing = await User.findByEmail('test@openclaw.dev');
    
    if (existing) {
      // Mettre à jour
      await query(
        `UPDATE users 
         SET plan_type = 'business', 
             max_bots = 10,
             status = 'active',
             email_verified = true,
             password_hash = $1,
             updated_at = NOW()
         WHERE email = 'test@openclaw.dev'`,
        [await bcrypt.hash('test123', 12)]
      );
      
      return res.json({ 
        success: true, 
        message: 'Utilisateur test mis à jour',
        user: {
          email: 'test@openclaw.dev',
          password: 'test123',
          plan: 'business',
          maxBots: 10
        }
      });
    }
    
    // Créer l'utilisateur
    const user = await User.create({
      email: 'test@openclaw.dev',
      password: 'test123',
      name: 'Test User',
      planType: 'BUSINESS'
    });
    
    // Mettre à jour max_bots
    await query(
      'UPDATE users SET max_bots = 10 WHERE id = $1',
      [user.id]
    );
    
    res.json({ 
      success: true, 
      message: 'Utilisateur test créé',
      user: {
        email: 'test@openclaw.dev',
        password: 'test123',
        plan: 'business',
        maxBots: 10
      }
    });
  } catch (error) {
    console.error('Setup test user error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
