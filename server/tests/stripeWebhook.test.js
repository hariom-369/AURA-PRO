import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/stripeClient.js', () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}));

const { getStripe } = await import('../services/stripeClient.js');
const { stripeWebhook } = await import('../controllers/paymentController.js');
const Order = (await import('../models/Order.js')).default;
const Product = (await import('../models/Product.js')).default;
// Registers the User model — required because Order.findById(...).populate('user') needs
// it registered, which normally happens for free via app.js's full route import graph.
await import('../models/User.js');

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), end: vi.fn() };
}

async function makeOrder() {
  const product = await Product.create({
    name: 'Webhook Test Product',
    slug: `webhook-test-${Date.now()}`,
    category: 'Audio',
    description: 'Product for webhook tests.',
    price: 500,
    stock: 5,
    images: ['https://example.com/img.jpg'],
  });

  return Order.create({
    orderItems: [{ name: product.name, quantity: 1, priceInPaise: 50000, product: product._id }],
    shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001', country: 'IN' },
    itemsPriceInPaise: 50000,
    taxPriceInPaise: 9000,
    shippingPriceInPaise: 9900,
    totalPriceInPaise: 68900,
  });
}

describe('Stripe webhook (checkout.session.completed)', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    vi.clearAllMocks();
  });

  it('marks the order paid/confirmed when the session references a valid order', async () => {
    const order = await makeOrder();

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => ({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              payment_intent: 'pi_test_123',
              payment_status: 'paid',
              metadata: { orderId: order._id.toString() },
              customer_details: { email: 'buyer@example.com' },
            },
          },
        })),
      },
    });

    const req = { headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') };
    const res = mockRes();

    await stripeWebhook(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);

    const updated = await Order.findById(order._id);
    expect(updated.isPaid).toBe(true);
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.paymentStatus).toBe('Completed');
    expect(updated.paymentIntentId).toBe('pi_test_123');
    expect(updated.timeline.some((t) => t.status === 'CONFIRMED')).toBe(true);
  });

  it('rejects a request with an invalid signature without touching the order', async () => {
    const order = await makeOrder();

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => {
          throw new Error('signature mismatch');
        }),
      },
    });

    const req = { headers: { 'stripe-signature': 'bad-sig' }, body: Buffer.from('{}') };
    const res = mockRes();

    await stripeWebhook(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);

    const unchanged = await Order.findById(order._id);
    expect(unchanged.isPaid).toBe(false);
  });

  it('is idempotent — replaying the same event on an already-paid order does not duplicate the timeline entry', async () => {
    const order = await makeOrder();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          payment_status: 'paid',
          metadata: { orderId: order._id.toString() },
          customer_details: { email: 'buyer@example.com' },
        },
      },
    };
    getStripe.mockReturnValue({ webhooks: { constructEvent: vi.fn(() => event) } });

    const req = { headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') };
    await stripeWebhook(req, mockRes(), vi.fn());
    await stripeWebhook(req, mockRes(), vi.fn());

    const updated = await Order.findById(order._id);
    expect(updated.timeline.filter((t) => t.status === 'CONFIRMED')).toHaveLength(1);
  });
});
