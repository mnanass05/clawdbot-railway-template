#!/usr/bin/env node
/**
 * Initial Setup Script
 * Creates database, runs migrations, creates admin user
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function setup() {
  console.log('🚀 OpenClaw SaaS Setup\n');
  console.log('======================\n');

  // Check environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env file');
    console.log('\nPlease create a .env file with:');
    console.log('DATABASE_URL=postgresql://user:pass@host:5432/db');
    process.exit(1);
  }

  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found, copying from .env.example...');
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('✅ Created .env from example\n');
    }
  }

  // Run migrations
  console.log('🗄️  Running database migrations...\n');
  try {
    execSync('node scripts/migrate.js', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('❌ Migration failed');
    process.exit(1);
  }

  // Create admin user
  console.log('\n👤 Creating admin user...\n');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@openclaw.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Check if admin exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existing.rows.length > 0) {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    } else {
      // Create admin
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      await client.query(
        `INSERT INTO users (email, password_hash, name, plan_type, max_bots, email_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminEmail, passwordHash, 'Admin User', 'business', 10, true, 'active']
      );

      console.log(`✅ Admin user created:`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    }

    // Create test user
    const testEmail = 'test@openclaw.dev';
    const testPassword = 'test123';
    
    const testExisting = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [testEmail]
    );

    if (testExisting.rows.length === 0) {
      const testPasswordHash = await bcrypt.hash(testPassword, 12);
      
      await client.query(
        `INSERT INTO users (email, password_hash, name, plan_type, max_bots, email_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testEmail, testPasswordHash, 'Test User', 'free', 1, true, 'active']
      );

      console.log(`\n✅ Test user created:`);
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
    }

    await client.end();

    console.log('\n✅ Setup complete!\n');
    console.log('🚀 Next steps:');
    console.log('   1. npm install (if not done)');
    console.log('   2. npm run dev (for development)');
    console.log('   3. Open http://localhost:8080');
    console.log('\n📚 Default accounts:');
    console.log(`   Admin: ${adminEmail} / ${adminPassword}`);
    console.log(`   Test:  ${testEmail} / ${testPassword}`);

  } catch (error) {
    console.error('❌ Setup error:', error.message);
    await client.end();
    process.exit(1);
  }
}

setup();
