import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Product from '../models/Product.js';

// Registration now requires OTP verification before an access token is
// issued. SMTP is intentionally unconfigured in tests, so the server returns
// the code via `devCode` (its non-production fallback) — complete that step
// here so callers still get back a normal usable token.
async function registerUser(email = 'buyer@example.com') {
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Buyer', email, password: 'password123', phone: '9876543210' });

  const { pendingToken, devCode } = registerRes.body.data;
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-signup-otp')
    .send({ pendingToken, code: devCode });

  return verifyRes.body.data.token;
}

describe('Order flow (register -> cart -> order)', () => {
  let token;
  let product;

  beforeEach(async () => {
    token = await registerUser();
    product = await Product.create({
      name: 'Integration Test Headphones',
      slug: 'integration-test-headphones',
      category: 'Audio',
      description: 'Product used for order integration tests.',
      price: 500,
      stock: 5,
      images: ['https://example.com/img.jpg'],
    });
  });

  it('adds an item to the cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it('rejects checkout with an empty cart', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cart is empty/i);
  });

  it('creates a PENDING order, decrements stock, and clears the cart', async () => {
    await request(app)
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data.status).toBe('PENDING');
    expect(orderRes.body.data.isPaid).toBe(false);
    expect(orderRes.body.data.itemsPriceInPaise).toBe(2 * 500 * 100);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(3); // 5 - 2

    const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    expect(cartRes.body.data.items).toHaveLength(0);
  });

  it('rejects an order that exceeds available stock', async () => {
    await request(app)
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 100 });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });

    expect(orderRes.status).toBeGreaterThanOrEqual(400);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(5); // unchanged — rejected before any decrement
  });

  it('rejects order creation without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });

    expect(res.status).toBe(401);
  });
});
