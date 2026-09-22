import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['customer', 'admin']),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
