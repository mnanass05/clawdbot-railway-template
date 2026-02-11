#!/usr/bin/env node
/**
 * Test database connection
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_hE9VbmlC1ifN@ep-dry-frost-abpycnlu-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testConnection() {
  console.log('🔌 Testing database connection...');
  console.log(`URL: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);
  console.log('');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Test query
    const result = await client.query('SELECT NOW() as time, version() as version');
    console.log(`⏰ Server Time: ${result.rows[0].time}`);
    console.log(`🗄️  PostgreSQL Version: ${result.rows[0].version}`);
    
    // Check existing tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('📋 No tables found (fresh database)');
    }
    
    console.log('');
    console.log('✅ Database is ready for deployment!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
