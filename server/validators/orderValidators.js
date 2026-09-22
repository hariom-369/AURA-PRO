import { z } from 'zod';

const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  address: z.string().trim().min(1, 'Address is required').max(300),
  addressLine2: z.string().trim().max(300).optional(),
  city: z.string().trim().min(1, 'City is required').max(120),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.string().trim().max(30).optional(),
  shippingMethod: z.enum(['STANDARD', 'EXPRESS']).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

export const previewOrderSchema = z.object({
  shippingMethod: z.enum(['STANDARD', 'EXPRESS']).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURN_REQUESTED',
    'RETURNED',
    'REFUNDED',
  ]),
  note: z.string().trim().max(500).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
});

export const requestReturnSchema = z.object({
  reason: z.string().trim().min(1, 'Please provide a reason for the return').max(500),
});
