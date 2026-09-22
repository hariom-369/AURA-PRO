import { z } from 'zod';

const specificationSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  description: z.string().trim().min(1, 'Description is required'),
  shortDescription: z.string().trim().max(300).optional(),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  originalPrice: z.coerce.number().min(0).optional(),
  images: z.array(z.string().url('Each image must be a valid URL')).optional().default([]),
  stock: z.coerce.number().int().min(0).optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  specifications: z.array(specificationSchema).optional().default([]),
  tags: z.array(z.string().trim()).optional().default([]),
  isFeatured: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();
