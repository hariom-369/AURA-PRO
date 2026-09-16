import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  process.env.ADMIN_URL || 'http://localhost:5173'
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation: Access denied.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key']
});

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://images.unsplash.com'],
      connectSrc: ["'self'", 'https://api.stripe.com', process.env.CLIENT_URL || 'http://localhost:5173']
    }
  },
  crossOriginEmbedderPolicy: false
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Excessive authentication attempts. Account locked temporarily for security.' }
});

export const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many checkout attempts. Please verify your order status before retrying.' }
});

export const sanitizeData = mongoSanitize();
export const preventPollution = hpp({ whitelist: ['category', 'brand', 'price', 'rating', 'sort'] });