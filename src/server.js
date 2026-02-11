#!/usr/bin/env node
/**
 * OpenClaw SaaS - Main Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import botRoutes from './routes/bots.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import createRateLimiter from './middleware/rateLimit.js';
import { checkConnection } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// Middleware
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for now
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Rate limiting
app.use(createRateLimiter());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// ============================================
// Health Check & Root
// ============================================

// Root route - Serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', async (req, res) => {
  const dbStatus = await checkConnection();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus.connected ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// ============================================
// Webhook Routes (Telegram)
// ============================================
import botManager from './services/BotManager.js';

app.post('/webhook/telegram/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    await botManager.handleTelegramUpdate(botId, req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.sendStatus(200); // Always return 200 to Telegram
  }
});

// ============================================
// API Routes
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);

// ============================================
// Dashboard Route (serve SPA)
// ============================================

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Start Server
// ============================================

async function startServer() {
  try {
    // Check database connection (with retry for Railway)
    console.log('🔌 Checking database connection...');
    let dbStatus = await checkConnection();
    let retries = 0;
    const maxRetries = 5;
    
    while (!dbStatus.connected && retries < maxRetries) {
      retries++;
      console.log(`⏳ Database connection attempt ${retries}/${maxRetries} failed, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      dbStatus = await checkConnection();
    }
    
    if (!dbStatus.connected) {
      console.warn('⚠️ Database connection failed, starting server anyway...');
      console.warn('Error:', dbStatus.error);
    } else {
      console.log('✅ Database connected');
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 OpenClaw SaaS server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 API: http://localhost:${PORT}/api`);
      console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    // Don't exit, let Railway retry
    console.log('🔄 Server will retry...');
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Start
startServer();

export default app;
// Build time: Mon Feb  9 22:23:49 +01 2026
