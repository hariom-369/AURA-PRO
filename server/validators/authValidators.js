import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
  // Optional — only grants admin if it matches ADMIN_SIGNUP_CODE server-side (see authController).
  adminCode: z.string().trim().max(200).optional(),
});

// Login accepts either an email or a mobile number in the same field — the
// controller looks up whichever one matches.
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const verifyOtpSchema = z.object({
  pendingToken: z.string().min(1, 'A pending verification session is required'),
  code: otpCodeSchema,
});

export const resendOtpSchema = z.object({
  pendingToken: z.string().min(1, 'A pending verification session is required'),
  purpose: z.enum(['SIGNUP_VERIFICATION', 'LOGIN', 'PASSWORD_RESET']),
});

export const resetPasswordSchema = z.object({
  pendingToken: z.string().min(1, 'A pending verification session is required'),
  code: otpCodeSchema,
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
