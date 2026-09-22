import express from 'express';
import {
  registerUser,
  loginUser,
  verifySignupOtp,
  verifyLoginOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
  uploadAvatar,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/security.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Only the credential-guessing/OTP-guessing-sensitive endpoints are rate
// limited here — GET /me is called on every page load to restore a session,
// so it must not share this budget or a few page refreshes would lock a user out.
router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);
router.post('/verify-signup-otp', authLimiter, validate(verifyOtpSchema), verifySignupOtp);
router.post('/verify-login-otp', authLimiter, validate(verifyOtpSchema), verifyLoginOtp);
router.post('/resend-otp', authLimiter, validate(resendOtpSchema), resendOtp);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, validate(updateProfileSchema), updateProfile);
router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);
router.post('/change-password', protect, authLimiter, validate(changePasswordSchema), changePassword);

export default router;
