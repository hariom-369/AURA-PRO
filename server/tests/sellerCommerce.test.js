import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isEmailConfigured: vi.fn(() => false) };
});

vi.mock('../services/sellerDocumentService.js', () => ({
  uploadSellerDocument: vi.fn(async () => ({ publicId: 'mock/doc', resourceType: 'image' })),
  getSignedDocumentUrl: vi.fn(() => 'https://res.cloudinary.com/mock/signed-url'),
  deleteSellerDocument: vi.fn(async () => {}),
}));

vi.mock('../services/stripeClient.js', () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}));

const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;
const Product = (await import('../models/Product.js')).default;
const Order = (await import('../models/Order.js')).default;
const Seller = (await import('../models/Seller.js')).default;
const SellerTransaction = (await import('../models/SellerTransaction.js')).default;
const { getStripe } = await import('../services/stripeClient.js');
const { stripeWebhook } = await import('../controllers/paymentController.js');

// These commerce/payment tests don't exercise auth at all, so a test user is
// created directly rather than through the real register endpoint — same
// session shape (generateAuthToken()) any login method produces.
let userCounter = 0;
async function registerCustomer() {
  userCounter += 1;
  const email = `commerce-${userCounter}@example.com`;
  const user = await User.create({
    name: 'Buyer',
    email,
    phone: `91000000${String(userCounter).padStart(2, '0')}`,
    password: 'password123',
  });
  return { token: user.generateAuthToken(), userId: user._id.toString(), email };
}

function authed(token) {
  return { Authorization: `Bearer ${token}` };
}

async function makeApprovedSeller(commissionPercent) {
  const applicant = await registerCustomer();
  await request(app)
    .patch('/api/v1/seller/application/account')
    .set(authed(applicant.token))
    .send({ contactEmail: applicant.email, contactPhone: '9000000001' });
  await request(app)
    .patch('/api/v1/seller/application/business')
    .set(authed(applicant.token))
    .send({ legalName: 'Acme Traders', storeName: `Store-${Date.now()}-${Math.random()}` });
  await request(app)
    .patch('/api/v1/seller/application/payout')
    .set(authed(applicant.token))
    .send({ accountHolderName: 'A Trader', bankName: 'Test Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' });
  await request(app)
    .post('/api/v1/seller/application/verification/documents')
    .set(authed(applicant.token))
    .field('type', 'gstin_certificate')
    .attach('document', Buffer.from('bytes'), 'gst.png');
  await request(app).post('/api/v1/seller/application/submit').set(authed(applicant.token));

  const seller = await Seller.findOne({ user: applicant.userId });
  await request(app).patch(`/api/v1/admin/sellers/${seller._id}/status`).set(authed(await adminToken())).send({ status: 'approved' });
  if (commissionPercent !== undefined) {
    await Seller.updateOne({ _id: seller._id }, { commissionPercent });
  }
  return { ...applicant, sellerId: seller._id };
}

let cachedAdminToken;
async function adminToken() {
  if (cachedAdminToken) return cachedAdminToken;
  const admin = await registerCustomer();
  await User.updateOne({ _id: admin.userId }, { role: 'admin' });
  cachedAdminToken = admin.token;
  return cachedAdminToken;
}

async function makePlatformProduct() {
  return Product.create({
    name: 'Platform Widget',
    slug: `platform-widget-${Date.now()}-${Math.random()}`,
    category: 'Gadgets',
    description: 'A platform-owned product.',
    price: 500,
    stock: 50,
    images: ['https://example.com/a.jpg'],
  });
}

afterEach(() => {
  cachedAdminToken = undefined;
});

describe('Seller product ownership', () => {
  it('an approved seller can create, update, and delete their own product', async () => {
    const seller = await makeApprovedSeller();

    const createRes = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(seller.token))
      .send({ name: 'Handmade Mug', category: 'Home', description: 'A mug.', price: 299, stock: 10, images: ['https://example.com/mug.jpg'] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.seller).toBe(seller.sellerId.toString());

    const updateRes = await request(app)
      .put(`/api/v1/seller/products/${createRes.body.data._id}`)
      .set(authed(seller.token))
      .send({ price: 349 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.price).toBe(349);

    const deleteRes = await request(app).delete(`/api/v1/seller/products/${createRes.body.data._id}`).set(authed(seller.token));
    expect(deleteRes.status).toBe(200);
    expect(await Product.findById(createRes.body.data._id)).toBeNull();
  });

  it('a seller cannot edit or delete another seller\'s product', async () => {
    const sellerA = await makeApprovedSeller();
    const sellerB = await makeApprovedSeller();

    const createRes = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(sellerA.token))
      .send({ name: 'A-Only Product', category: 'Home', description: 'x', price: 100, stock: 5, images: ['https://example.com/x.jpg'] });

    const editAttempt = await request(app)
      .put(`/api/v1/seller/products/${createRes.body.data._id}`)
      .set(authed(sellerB.token))
      .send({ price: 1 });
    expect(editAttempt.status).toBe(403);

    const deleteAttempt = await request(app).delete(`/api/v1/seller/products/${createRes.body.data._id}`).set(authed(sellerB.token));
    expect(deleteAttempt.status).toBe(403);
  });

  it('a seller only sees their own products in the seller product list', async () => {
    const sellerA = await makeApprovedSeller();
    const sellerB = await makeApprovedSeller();
    await request(app)
      .post('/api/v1/seller/products')
      .set(authed(sellerA.token))
      .send({ name: 'A Product', category: 'Home', description: 'x', price: 100, stock: 5, images: ['https://example.com/x.jpg'] });
    await request(app)
      .post('/api/v1/seller/products')
      .set(authed(sellerB.token))
      .send({ name: 'B Product', category: 'Home', description: 'x', price: 100, stock: 5, images: ['https://example.com/x.jpg'] });

    const res = await request(app).get('/api/v1/seller/products').set(authed(sellerA.token));
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].name).toBe('A Product');
  });

  it('a non-approved (pending) seller cannot access seller product endpoints', async () => {
    const applicant = await registerCustomer();
    const res = await request(app).get('/api/v1/seller/products').set(authed(applicant.token));
    expect(res.status).toBe(403);
  });

  it('cannot smuggle a different seller id via the request body', async () => {
    const sellerA = await makeApprovedSeller();
    const sellerB = await makeApprovedSeller();

    const res = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(sellerA.token))
      .send({ name: 'Spoofed', category: 'Home', description: 'x', price: 100, stock: 5, images: ['https://example.com/x.jpg'], seller: sellerB.sellerId.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.seller).toBe(sellerA.sellerId.toString()); // never sellerB's id
  });
});

describe('Multi-seller order lifecycle', () => {
  it('stamps each order item with the correct seller, and platform items with null', async () => {
    const seller = await makeApprovedSeller();
    const sellerProductRes = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(seller.token))
      .send({ name: 'Seller Item', category: 'Home', description: 'x', price: 1000, stock: 20, images: ['https://example.com/x.jpg'] });
    const platformProduct = await makePlatformProduct();
    const buyer = await registerCustomer();

    await request(app).post('/api/v1/cart').set(authed(buyer.token)).send({ productId: sellerProductRes.body.data._id, quantity: 2 });
    await request(app).post('/api/v1/cart').set(authed(buyer.token)).send({ productId: platformProduct._id.toString(), quantity: 1 });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set(authed(buyer.token))
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });

    expect(orderRes.status).toBe(201);
    const items = orderRes.body.data.orderItems;
    const sellerItem = items.find((i) => i.product === sellerProductRes.body.data._id);
    const platformItem = items.find((i) => i.product === platformProduct._id.toString());
    expect(sellerItem.seller).toBe(seller.sellerId.toString());
    expect(platformItem.seller).toBeFalsy();
  });

  it('records a seller ledger entry with correct commission math on payment confirmation, visible only to that seller', async () => {
    const seller = await makeApprovedSeller(20); // 20% commission override
    const sellerProductRes = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(seller.token))
      .send({ name: 'Ledger Item', category: 'Home', description: 'x', price: 1000, stock: 20, images: ['https://example.com/x.jpg'] });
    const otherSeller = await makeApprovedSeller();
    const buyer = await registerCustomer();

    await request(app).post('/api/v1/cart').set(authed(buyer.token)).send({ productId: sellerProductRes.body.data._id, quantity: 3 });
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set(authed(buyer.token))
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });
    const orderId = orderRes.body.data._id;

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => ({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_seller',
              payment_intent: 'pi_test_seller',
              payment_status: 'paid',
              metadata: { orderId },
              customer_details: { email: buyer.email },
            },
          },
        })),
      },
    });
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), end: vi.fn() };
    await stripeWebhook({ headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') }, mockRes, vi.fn());

    // 3 * 100000 paise = 300000 gross, 20% commission = 60000, net = 240000
    const transactions = await SellerTransaction.find({ order: orderId });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].grossAmountInPaise).toBe(300000);
    expect(transactions[0].commissionPercent).toBe(20);
    expect(transactions[0].commissionAmountInPaise).toBe(60000);
    expect(transactions[0].netAmountInPaise).toBe(240000);

    // Visible via the seller's own order list...
    const ownOrders = await request(app).get('/api/v1/seller/orders').set(authed(seller.token));
    expect(ownOrders.body.data.orders.some((o) => o._id === orderId)).toBe(true);

    // ...but never to an unrelated seller.
    const otherOrders = await request(app).get('/api/v1/seller/orders').set(authed(otherSeller.token));
    expect(otherOrders.body.data.orders.some((o) => o._id === orderId)).toBe(false);

    // And seller analytics reflects it.
    const analytics = await request(app).get('/api/v1/seller/analytics/overview').set(authed(seller.token));
    expect(analytics.body.data.netEarningsInPaise).toBe(240000);
  });

  it('a seller can update fulfillment status only for their own order items', async () => {
    const sellerA = await makeApprovedSeller();
    const sellerB = await makeApprovedSeller();
    const productA = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(sellerA.token))
      .send({ name: 'Item A', category: 'Home', description: 'x', price: 500, stock: 10, images: ['https://example.com/x.jpg'] });
    const buyer = await registerCustomer();
    await request(app).post('/api/v1/cart').set(authed(buyer.token)).send({ productId: productA.body.data._id, quantity: 1 });
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set(authed(buyer.token))
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });
    const orderId = orderRes.body.data._id;
    const itemId = orderRes.body.data.orderItems[0]._id;

    // Mark it paid directly (bypassing Stripe) so the item is visible/actionable.
    await Order.updateOne({ _id: orderId }, { isPaid: true, status: 'CONFIRMED' });

    const wrongSellerAttempt = await request(app)
      .patch(`/api/v1/seller/orders/${orderId}/items/${itemId}/fulfillment`)
      .set(authed(sellerB.token))
      .send({ status: 'PACKED' });
    expect(wrongSellerAttempt.status).toBe(403);

    const rightSellerAttempt = await request(app)
      .patch(`/api/v1/seller/orders/${orderId}/items/${itemId}/fulfillment`)
      .set(authed(sellerA.token))
      .send({ status: 'PACKED' });
    expect(rightSellerAttempt.status).toBe(200);
    expect(rightSellerAttempt.body.data.orderItems[0].fulfillmentStatus).toBe('PACKED');
  });

  it('reverses seller ledger entries when an admin refunds a return', async () => {
    const seller = await makeApprovedSeller();
    const productRes = await request(app)
      .post('/api/v1/seller/products')
      .set(authed(seller.token))
      .send({ name: 'Returnable Item', category: 'Home', description: 'x', price: 1000, stock: 20, images: ['https://example.com/x.jpg'] });
    const buyer = await registerCustomer();
    await request(app).post('/api/v1/cart').set(authed(buyer.token)).send({ productId: productRes.body.data._id, quantity: 1 });
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set(authed(buyer.token))
      .send({ shippingAddress: { address: '1 Main St', city: 'Mumbai', postalCode: '400001' } });
    const orderId = orderRes.body.data._id;

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => ({
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_r', payment_intent: 'pi_r', payment_status: 'paid', metadata: { orderId }, customer_details: {} } },
        })),
      },
      refunds: { create: vi.fn(async () => ({ id: 're_1' })) },
    });
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    await stripeWebhook(
      { headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') },
      { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), end: vi.fn() },
      vi.fn()
    );

    await Order.updateOne({ _id: orderId }, { status: 'DELIVERED', deliveredAt: new Date() });
    await Order.updateOne({ _id: orderId }, { status: 'RETURN_REQUESTED' });

    const adminAuth = authed(await adminToken());
    const approveRes = await request(app).post(`/api/v1/orders/admin/${orderId}/approve-return`).set(adminAuth);
    expect(approveRes.status).toBe(200);

    const transactions = await SellerTransaction.find({ order: orderId });
    expect(transactions.every((t) => t.status === 'reversed')).toBe(true);
  });
});
