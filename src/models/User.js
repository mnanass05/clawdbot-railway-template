/**
 * User Model
 * Database operations for users
 */

import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/database.js';
import { PLANS } from '../config/constants.js';

class UserModel {
  /**
   * Create a new user
   */
  async create({ email, password, name, planType = 'free' }) {
    const passwordHash = await bcrypt.hash(password, 12);
    const maxBots = PLANS[planType.toUpperCase()]?.maxBots || 1;

    const result = await query(
      `INSERT INTO users (email, password_hash, name, plan_type, max_bots)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, plan_type, max_bots, status, created_at`,
      [email.toLowerCase(), passwordHash, name, planType, maxBots]
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  async findById(id) {
    const result = await query(
      `SELECT id, email, name, email_verified, plan_type, status, max_bots, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const result = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  async verifyPassword(userId, password) {
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (!result.rows[0]) return false;
    
    return bcrypt.compare(password, result.rows[0].password_hash);
  }

  /**
   * Update user
   */
  async update(id, updates) {
    const allowedFields = ['name', 'plan_type', 'status', 'email_verified'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Update password
   */
  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );
    return true;
  }

  /**
   * Delete user
   */
  async delete(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  /**
   * Get user with bot count
   */
  async getWithStats(id) {
    const result = await query(
      `SELECT u.*, COUNT(b.id) as bot_count
       FROM users u
       LEFT JOIN bots b ON b.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * List all users (for admin)
   */
  async listAll(options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    const result = await query(
      `SELECT u.*, COUNT(b.id) as bot_count
       FROM users u
       LEFT JOIN bots b ON b.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  }

  /**
   * Count total users
   */
  async count() {
    const result = await query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
  }
}

export const User = new UserModel();
export default User;
