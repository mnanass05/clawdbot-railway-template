#!/usr/bin/env node
/**
 * Create admin user with hashed password
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_hE9VbmlC1ifN@ep-dry-frost-abpycnlu-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full";

// Admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@openclaw.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function createAdmin() {
  console.log('🔌 Connecting to database...');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('✅ Connected to database');
  
  try {
    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    
    // Check if admin exists
    const checkResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );
    
    if (checkResult.rows.length > 0) {
      // Update password
      console.log('👤 Admin user exists, updating password...');
      await client.query(
        'UPDATE users SET password_hash = $1, status = $2 WHERE email = $3',
        [passwordHash, 'active', ADMIN_EMAIL]
      );
      console.log('✅ Admin password updated!');
    } else {
      // Create admin user
      console.log('👤 Creating admin user...');
      await client.query(
        `INSERT INTO users (email, password_hash, name, plan_type, max_bots, status, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ADMIN_EMAIL, passwordHash, 'Admin User', 'business', 100, 'active', true]
      );
      console.log('✅ Admin user created!');
    }
    
    console.log('');
    console.log('📧 Admin Email:', ADMIN_EMAIL);
    console.log('🔑 Admin Password:', ADMIN_PASSWORD);
    console.log('');
    console.log('✅ You can now login with these credentials!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createAdmin();
