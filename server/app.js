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
  aiLimiter,
  sanitizeData,
  preventPollution
} from './middleware/security.js';

// API Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import { stripeWebhook } from './controllers/paymentController.js';

dotenv.config();

const app = express();

// Trust the first hop reverse proxy (standard on Render/Railway/behind any
// load balancer) so req.ip reflects the real client, not the proxy — this
// matters for rate limiting and any IP-based logic to work correctly in
// production. Safe to leave on in dev too since there's no proxy to spoof it.
app.set('trust proxy', 1);

// Security Headers & CORS Configuration
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Stripe webhook needs the raw request body for signature verification, so it
// must be mounted before the global JSON body parser below.
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

// Body Parsing & Input Sanitization
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeData);
app.use(preventPollution);

// Targeted Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/v1/ai', aiLimiter);

// Health Check Endpoints — public, unauthenticated, no sensitive data. `/`
// exists purely so hitting the bare backend URL (e.g. in a browser, or a
// platform's default health probe) gets a friendly response instead of the
// generic 404 fallback; it intentionally carries no auth and changes nothing
// about how any /api/v1/* route is protected.
app.get('/', (req, res) => {
  res.status(200).json(new ApiResponse(200, { docs: '/api/health' }, 'AURA PRO API is running. See /api/health for a liveness check.'));
});

app.get('/api/health', (req, res) => {
  res.status(200).json(new ApiResponse(200, null, 'E-commerce API is running seamlessly.'));
});

// Mounted Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/seller', sellerRoutes);

// Unhandled Route Handler (404 Fallback)
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorMiddleware);

export default app;