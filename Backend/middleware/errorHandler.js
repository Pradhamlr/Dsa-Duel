import * as Sentry from '@sentry/node';

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // isOperational errors (AppError, DTO validation, etc.) are expected/handled cases --
  // real user input problems, not bugs. Only genuinely unexpected errors are worth the
  // structured error-level log; logging every 404/validation error at error severity
  // would drown out the signal this is supposed to surface.
  if (!err.isOperational) {
    req.log.error({ err }, err.message);
    Sentry.captureException(err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401, code: 'INVALID_TOKEN' };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401, code: 'TOKEN_EXPIRED' };
  }

  // Prisma errors
  if (err.code === 'P2002') {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400, code: 'DUPLICATE_FIELD' };
  }

  if (err.code === 'P2025') {
    const message = 'Record not found';
    error = { message, statusCode: 404, code: 'RECORD_NOT_FOUND' };
  }

  const response = {
    success: false,
    error: error.message || 'Server Error',
    code: error.code || 'SERVER_ERROR'
  };

  if (error.details) {
    response.details = error.details;
  }

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

export default errorHandler;
