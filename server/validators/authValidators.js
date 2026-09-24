import { z } from 'zod';
import { isPasswordStrongEnough, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';

const passwordSchema = z.string().refine(isPasswordStrongEnough, { message: PASSWORD_POLICY_MESSAGE });

// `turnstileToken` is deliberately NOT included here — requireTurnstile
// (middleware/turnstileMiddleware.js) reads it off the raw, pre-validation
// req.body and runs before this schema, so a bot-check failure never even
// reaches Zod/business logic. `accountType` (buyer/seller) is intentionally
// never accepted here either — it's pure frontend redirect intent (see
// AuthContext/Login.jsx); accepting it server-side would just invite someone
// to try setting it to something privileged, so the safest design is to
// never read it at all. Role always defaults to 'customer' on creation.
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, { message: 'You must accept the Terms and Privacy Policy' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  // Not a trust/security field — only ever decides token lifetime and
  // where the frontend stores it (localStorage vs sessionStorage). Never
  // used to decide who the user is.
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'A reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'A Google ID token is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  });
