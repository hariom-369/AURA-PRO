import { z } from 'zod';

export const createCouponSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().positive('Value must be greater than 0'),
  minOrderValueInPaise: z.coerce.number().min(0).optional(),
  maxDiscountInPaise: z.coerce.number().min(0).optional(),
  expiryDate: z.coerce.date({ message: 'A valid expiry date is required' }),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  perUserLimit: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();
