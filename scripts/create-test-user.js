#!/usr/bin/env node
/**
 * Script pour créer l'utilisateur test
 * Usage: node scripts/create-test-user.js
 */

import { query } from '../src/config/database.js';

async function createTestUser() {
  console.log('🔧 Création de l\'utilisateur test...\n');

  try {
    // Vérifier si l'utilisateur existe déjà
    const checkResult = await query(
      'SELECT id, email, plan_type, max_bots FROM users WHERE email = $1',
      ['test@openclaw.dev']
    );

    if (checkResult.rows.length > 0) {
      console.log('👤 Utilisateur test existe déjà :');
      console.log('  Email:', checkResult.rows[0].email);
      console.log('  Plan:', checkResult.rows[0].plan_type);
      console.log('  Max bots:', checkResult.rows[0].max_bots);
      
      // Mettre à jour vers BUSINESS
      await query(
        `UPDATE users 
         SET plan_type = 'business', 
             max_bots = 10,
             status = 'active',
             email_verified = true,
             password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I3K',
             updated_at = NOW()
         WHERE email = 'test@openclaw.dev'`
      );
      
      console.log('\n✅ Utilisateur mis à jour vers plan BUSINESS (10 bots)');
    } else {
      // Créer l'utilisateur
      const result = await query(
        `INSERT INTO users (
          email, 
          password_hash, 
          name, 
          plan_type, 
          max_bots, 
          status, 
          email_verified,
          created_at,
          updated_at
        ) VALUES (
          'test@openclaw.dev',
          '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I3K',
          'Test User',
          'business',
          10,
          'active',
          true,
          NOW(),
          NOW()
        )
        RETURNING id, email, plan_type, max_bots`,
      );

      console.log('✅ Utilisateur test créé avec succès !');
      console.log('  ID:', result.rows[0].id);
      console.log('  Email:', result.rows[0].email);
      console.log('  Plan:', result.rows[0].plan_type);
      console.log('  Max bots:', result.rows[0].max_bots);
    }

    console.log('\n📋 Informations de connexion :');
    console.log('  Email: test@openclaw.dev');
    console.log('  Mot de passe: test123');
    console.log('  URL: https://openclaw-saas-v2-production.up.railway.app/dashboard');
    console.log('\n🎉 Vous pouvez maintenant créer jusqu\'à 10 bots !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

createTestUser();
