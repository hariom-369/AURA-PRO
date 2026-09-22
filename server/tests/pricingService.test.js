import { describe, it, expect } from 'vitest';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { calculateOrderTotal } from '../services/pricingService.js';

async function makeProduct(overrides = {}) {
  return Product.create({
    name: 'Test Product',
    slug: `test-product-${Date.now()}-${Math.random()}`,
    category: 'Accessories',
    description: 'A product for pricing tests.',
    price: 100,
    stock: 10,
    images: ['https://example.com/img.jpg'],
    ...overrides,
  });
}

describe('pricingService.calculateOrderTotal', () => {
  it('computes subtotal, 18% GST, and standard shipping below the free-shipping threshold', async () => {
    const product = await makeProduct({ price: 100 });

    const { pricing } = await calculateOrderTotal([{ product: product._id, quantity: 2 }], null, 'STANDARD');

    expect(pricing.subtotalInPaise).toBe(20000); // 2 x ₹100
    expect(pricing.shippingInPaise).toBe(9900); // below ₹1999, standard shipping applies
    expect(pricing.taxInPaise).toBe(3600); // 18% of 20000
    expect(pricing.grandTotalInPaise).toBe(20000 + 9900 + 3600);
  });

  it('waives shipping once the discounted subtotal reaches ₹1999', async () => {
    const product = await makeProduct({ price: 2000 });

    const { pricing } = await calculateOrderTotal([{ product: product._id, quantity: 1 }], null, 'STANDARD');

    expect(pricing.shippingInPaise).toBe(0);
  });

  it('applies a percentage coupon, capped at maxDiscountInPaise', async () => {
    const product = await makeProduct({ price: 1000 });
    await Coupon.create({
      code: 'SAVE50',
      discountType: 'PERCENTAGE',
      value: 50,
      maxDiscountInPaise: 20000,
      expiryDate: new Date(Date.now() + 86400000),
    });

    const { pricing } = await calculateOrderTotal([{ product: product._id, quantity: 1 }], 'save50', 'STANDARD');

    // 50% of ₹1000 (100000 paise) would be 50000, but capped at 20000
    expect(pricing.discountInPaise).toBe(20000);
  });

  it('rejects an order containing more units than are in stock', async () => {
    const product = await makeProduct({ stock: 1 });

    await expect(calculateOrderTotal([{ product: product._id, quantity: 5 }], null, 'STANDARD')).rejects.toThrow(
      /Insufficient stock/
    );
  });

  it('rejects an order for an inactive product', async () => {
    const product = await makeProduct({ isActive: false });

    await expect(calculateOrderTotal([{ product: product._id, quantity: 1 }], null, 'STANDARD')).rejects.toThrow(
      /unavailable/
    );
  });
});
