#!/usr/bin/env node
/**
 * Database Migration Script - Simple Version
 * Handles existing database gracefully
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('🔌 Connecting to database...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('✅ Connected to database');
  
  try {
    // Check if essential tables already exist
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'bots', 'sessions')
    `);
    
    if (checkTables.rows.length >= 3) {
      console.log('✅ Database tables already exist, skipping migration');
      console.log(`   Found tables: ${checkTables.rows.map(r => r.table_name).join(', ')}`);
      return;
    }
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_init.sql');
    const sql = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('📦 Running migration: 001_init.sql');
    
    // Execute SQL - using simple approach
    await client.query(sql);
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    // If tables already exist, that's fine
    if (error.message.includes('already exists') || error.code === '42P07') {
      console.log('✅ Database objects already exist, ready to use');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

migrate();
