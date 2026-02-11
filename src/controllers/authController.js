/**
 * Authentication Controller
 * Handles user registration, login, logout
 */

import Joi from 'joi';
import { User } from '../models/User.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  name: Joi.string().optional().allow('')
}).unknown(true);

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password, name } = value;

  // Check if email exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError('Email already registered', 409);
  }

  // Create user
  const user = await User.create({ email, password, name });

  // Generate token
  const token = generateToken(user.id);
  setAuthCookie(res, token);

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan_type
    }
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password } = value;

  // Find user
  const user = await User.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const isValid = await User.verifyPassword(user.id, password);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check if account is active
  if (user.status !== 'active') {
    throw new AppError('Account is not active', 403);
  }

  // Generate token
  const token = generateToken(user.id);
  setAuthCookie(res, token);

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan_type,
      maxBots: user.max_bots
    }
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logout successful' });
});

/**
 * Get current user
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.getWithStats(req.user.id);
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan_type,
      maxBots: user.max_bots,
      botCount: parseInt(user.bot_count),
      emailVerified: user.email_verified,
      createdAt: user.created_at
    }
  });
});

/**
 * Update profile
 * PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const user = await User.update(req.user.id, value);
  
  res.json({
    message: 'Profile updated',
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

/**
 * Change password
 * PUT /api/auth/password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;

  // Verify current password
  const isValid = await User.verifyPassword(req.user.id, currentPassword);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  await User.updatePassword(req.user.id, newPassword);
  
  res.json({ message: 'Password updated successfully' });
});

export default {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword
};
