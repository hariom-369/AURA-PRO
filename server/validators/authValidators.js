import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const firebasePhoneLoginSchema = z.object({
  idToken: z.string().min(1, 'A Firebase ID token is required'),
  // Optional — only ever used to name a brand-new account on first signup;
  // ignored for a returning login or a claimed legacy account (see
  // findOrCreateUserFromFirebase). Never a role or permission field.
  name: z.string().trim().min(1, 'Name cannot be empty').max(150).optional(),
});
