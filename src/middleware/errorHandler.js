/**
 * Error Handling Middleware
 * Centralized error processing
 */

// NODE_ENV from process.env

/**
 * Global error handler
 */
export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || undefined;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errors = err.errors;
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  }

  if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  }

  if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
  }

  // Don't leak error details in production
  const response = {
    error: message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      details: err 
    })
  };

  res.status(statusCode).json(response);
}

/**
 * 404 handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Resource not found',
    path: req.path
  });
}

/**
 * Async handler wrapper
 * Catches errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export default errorHandler;
