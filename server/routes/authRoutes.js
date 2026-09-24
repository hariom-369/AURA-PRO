import express from 'express';
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  googleAuth,
  linkGoogleAccount,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/security.js';
import { requireTurnstile } from '../middleware/turnstileMiddleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  googleAuthSchema,
  updateProfileSchema,
} from '../validators/authValidators.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Turnstile runs before validation, reading the raw (pre-Zod) body — a
// missing/invalid/expired/reused challenge token is rejected before any
// validation or DB work happens at all. Only enforced when
// TURNSTILE_SECRET_KEY is configured (see turnstileMiddleware.js).
router.post('/register', authLimiter, requireTurnstile, validate(registerSchema), registerUser);
router.post('/login', authLimiter, requireTurnstile, validate(loginSchema), loginUser);
router.post('/forgot-password', authLimiter, requireTurnstile, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/google', authLimiter, validate(googleAuthSchema), googleAuth);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, validate(updateProfileSchema), updateProfile);
router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);
router.post('/me/link-google', protect, validate(googleAuthSchema), linkGoogleAccount);
router.post('/change-password', protect, authLimiter, validate(changePasswordSchema), changePassword);

export default router;
