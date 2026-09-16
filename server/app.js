import express from 'express';
import dotenv from 'dotenv';
import asyncHandler from './utils/asyncHandler.js';
import ApiError from './utils/ApiError.js';
import ApiResponse from './utils/ApiResponse.js';
import errorMiddleware from './middleware/errorMiddleware.js';

// Security Middlewares
import {
  corsMiddleware,
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  checkoutLimiter,
  sanitizeData,
  preventPollution
} from './middleware/security.js';

// API Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

dotenv.config();

const app = express();

// Security Headers & CORS Configuration
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body Parsing & Input Sanitization
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeData);
app.use(preventPollution);

// Targeted Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/orders', checkoutLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json(new ApiResponse(200, null, 'E-commerce API is running seamlessly.'));
});

// Mounted Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);

// Unhandled Route Handler (404 Fallback)
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorMiddleware);

export default app;