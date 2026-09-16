import ApiError from '../utils/ApiError.js';

const errorMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose invalid ObjectId format
  if (err.name === 'CastError') {
    const message = `Resource not found. Invalid ${err.path}`;
    error = new ApiError(404, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const message = `Duplicate value entered for ${field} field`;
    error = new ApiError(400, message);
  }

  // Mongoose validation failure
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ApiError(400, message);
  }

  // JWT authentication errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token. Authorization denied.');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired. Please log in again.');
  }

  // Stripe Payment Gateway errors
  if (err.type && err.type.startsWith('Stripe')) {
    error = new ApiError(400, err.message || 'Payment processing failed');
  }

  const statusCode = error.statusCode || 500;
  
  // Protect internal infrastructure details in production
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500 && !err.isOperational
      ? 'An unexpected server error occurred. Please try again later.'
      : error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorMiddleware;