/**
 * Bot Model
 * Database operations for bots
 */

import { query, transaction } from '../config/database.js';
import encryption from '../services/EncryptionService.js';

class BotModel {
  /**
   * Create a new bot
   */
  async create({ userId, name, platform, platformToken, aiProvider, aiToken, aiModel, systemPrompt, configJson = {} }) {
    // Encrypt sensitive tokens
    const platformTokenEncrypted = encryption.encrypt(platformToken);
    const aiTokenEncrypted = encryption.encrypt(aiToken);

    const result = await query(
      `INSERT INTO bots (user_id, name, platform, platform_token_encrypted, ai_provider, ai_token_encrypted, ai_model, system_prompt, config_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, name, platform, platformTokenEncrypted, aiProvider, aiTokenEncrypted, aiModel, systemPrompt, JSON.stringify(configJson)]
    );

    return this.sanitize(result.rows[0]);
  }

  /**
   * Find bot by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM bots WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.sanitize(result.rows[0]) : null;
  }

  /**
   * Find bot by ID with decrypted tokens (for internal use)
   */
  async findByIdWithTokens(id) {
    const result = await query(
      'SELECT * FROM bots WHERE id = $1',
      [id]
    );
    
    if (!result.rows[0]) return null;
    
    const bot = result.rows[0];
    return {
      ...this.sanitize(bot),
      platformToken: encryption.decrypt(bot.platform_token_encrypted),
      aiToken: encryption.decrypt(bot.ai_token_encrypted)
    };
  }

  /**
   * Find bot by Railway service ID
   */
  async findByServiceId(serviceId) {
    const result = await query(
      'SELECT * FROM bots WHERE railway_service_id = $1',
      [serviceId]
    );
    return result.rows[0] ? this.sanitize(result.rows[0]) : null;
  }

  /**
   * List bots by user
   */
  async findByUser(userId) {
    const result = await query(
      `SELECT id, user_id, name, platform, status, ai_provider, ai_model, internal_port, 
              memory_usage_mb, total_messages, last_activity_at, created_at, updated_at
       FROM bots WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Update bot
   */
  async update(id, updates) {
    const allowedFields = ['name', 'status', 'ai_provider', 'ai_model', 'system_prompt', 'config_json', 'internal_port', 'process_pid', 'memory_usage_mb', 'cpu_usage_percent', 'last_started_at', 'last_activity_at', 'total_messages', 'railway_service_id', 'webhook_url'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Handle regular fields
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(key === 'config_json' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    // Handle encrypted token fields
    if (updates.ai_token) {
      fields.push(`ai_token_encrypted = $${paramIndex}`);
      values.push(encryption.encrypt(updates.ai_token));
      paramIndex++;
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE bots SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await query(sql, values);
    return result.rows[0] ? this.sanitize(result.rows[0]) : null;
  }

  /**
   * Update bot status
   */
  async updateStatus(id, status) {
    const result = await query(
      'UPDATE bots SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }

  /**
   * Update runtime info (port, PID)
   */
  async updateRuntime(id, { port, pid }) {
    const result = await query(
      'UPDATE bots SET internal_port = $1, process_pid = $2, last_started_at = NOW() WHERE id = $3 RETURNING *',
      [port, pid, id]
    );
    return result.rows[0];
  }

  /**
   * Increment message count
   */
  async incrementMessages(id) {
    await query(
      'UPDATE bots SET total_messages = total_messages + 1, last_activity_at = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * Delete bot
   */
  async delete(id) {
    await query('DELETE FROM bots WHERE id = $1', [id]);
    return true;
  }

  /**
   * Count bots by user
   */
  async countByUser(userId) {
    const result = await query(
      'SELECT COUNT(*) FROM bots WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count running bots
   */
  async countRunning() {
    const result = await query(
      "SELECT COUNT(*) FROM bots WHERE status = 'running'"
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get all running bots
   */
  async getRunning() {
    const result = await query(
      "SELECT * FROM bots WHERE status = 'running'"
    );
    return result.rows;
  }

  /**
   * Get bots by status
   */
  async getByStatus(status) {
    const result = await query(
      'SELECT * FROM bots WHERE status = $1',
      [status]
    );
    return result.rows.map(bot => this.sanitize(bot));
  }

  /**
   * Sanitize bot object (remove encrypted fields)
   */
  sanitize(bot) {
    if (!bot) return null;
    const { platform_token_encrypted, ai_token_encrypted, ...sanitized } = bot;
    return sanitized;
  }
}

export const Bot = new BotModel();
export default Bot;
