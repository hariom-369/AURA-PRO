import { z } from 'zod';
import { SELLER_STATUSES } from '../models/Seller.js';

const addressSchema = z.object({
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
});

export const updateAccountStepSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email('Invalid email address').optional(),
  contactPhone: z.string().trim().max(20).optional(),
});

export const updateBusinessStepSchema = z.object({
  legalName: z.string().trim().min(1).max(200).optional(),
  businessType: z.enum(['individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'other']).optional(),
  country: z.string().trim().max(100).optional(),
  address: addressSchema.optional(),
  gstin: z.string().trim().max(20).optional(),
  panNumber: z.string().trim().max(20).optional(),
  storeName: z.string().trim().min(1).max(150).optional(),
  storeDescription: z.string().trim().max(2000).optional(),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(['gstin_certificate', 'pan_card', 'address_proof', 'bank_proof', 'other']),
});

export const updatePayoutStepSchema = z.object({
  accountHolderName: z.string().trim().min(1).max(150).optional(),
  bankName: z.string().trim().min(1).max(150).optional(),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Enter a valid account number').optional(),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code')
    .optional(),
  pickupAddress: addressSchema.optional(),
  shippingPreferences: z
    .object({
      carrier: z.string().trim().max(100).optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export const adminListSellersSchema = z.object({
  status: z.enum(SELLER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateStoreSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(150).optional(),
  storeDescription: z.string().trim().max(2000).optional(),
  pickupAddress: addressSchema.optional(),
  shippingPreferences: z
    .object({
      carrier: z.string().trim().max(100).optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export const updateFulfillmentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
});

// Legal forward transitions an admin may apply. draft/submitted are entry
// points the applicant reaches on their own (never set directly by an admin).
const ADMIN_SETTABLE_STATUSES = ['under_review', 'action_required', 'approved', 'rejected', 'suspended'];
export const adminUpdateSellerStatusSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES),
  reason: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
});
