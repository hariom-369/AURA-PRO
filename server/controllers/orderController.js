import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { calculateOrderTotal } from '../services/pricingService.js';
import { reserveAndDeductStock, restoreStock, checkAndAlertLowStock } from '../services/inventoryService.js';
import { sendOrderStatusEmail } from '../services/emailService.js';
import { getStripe } from '../services/stripeClient.js';
import SellerTransaction from '../models/SellerTransaction.js';
import logger from '../utils/logger.js';

// @desc    Server-authoritative price preview for the checkout flow (no order is created)
// @route   POST /api/v1/orders/preview
export const previewOrder = asyncHandler(async (req, res) => {
  const { shippingMethod, couponCode } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty');
  }

  const cartItems = cart.items.map((item) => ({
    product: item.product,
    variantSku: item.variantSku,
    quantity: item.quantity,
  }));

  const { verifiedItems, pricing } = await calculateOrderTotal(
    cartItems,
    couponCode || cart.couponCode,
    shippingMethod || 'STANDARD'
  );

  res.status(200).json(new ApiResponse(200, { items: verifiedItems, pricing }, 'Order preview calculated'));
});

// @desc    Create new order from user's current cart (server-authoritative pricing)
// @route   POST /api/v1/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, shippingMethod, couponCode } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty');
  }

  const cartItems = cart.items.map((item) => ({
    product: item.product,
    variantSku: item.variantSku,
    quantity: item.quantity,
  }));

  // Server-side authoritative price recalculation — never trust client-sent totals
  const { verifiedItems, pricing } = await calculateOrderTotal(
    cartItems,
    couponCode || cart.couponCode,
    shippingMethod || 'STANDARD'
  );

  // Atomically reserve stock before creating the order to prevent overselling
  const stockItems = verifiedItems.map((item, idx) => ({
    product: item.product,
    sku: cartItems[idx].variantSku || null,
    quantity: item.quantity,
  }));

  try {
    await reserveAndDeductStock(stockItems);
  } catch (err) {
    throw new ApiError(409, err.message || 'One or more items are out of stock');
  }

  let order;
  try {
    const orderItems = verifiedItems.map((item, idx) => ({
      name: item.name,
      quantity: item.quantity,
      priceInPaise: item.unitPriceInPaise,
      sku: item.sku,
      variantSku: cartItems[idx].variantSku || null,
      product: item.product,
      seller: item.seller || null,
    }));

    order = await Order.create({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || 'Stripe',
      itemsPriceInPaise: pricing.subtotalInPaise,
      taxPriceInPaise: pricing.taxInPaise,
      shippingPriceInPaise: pricing.shippingInPaise,
      discountPriceInPaise: pricing.discountInPaise,
      totalPriceInPaise: pricing.grandTotalInPaise,
    });
  } catch (err) {
    // Roll back the stock reservation if order creation fails
    await restoreStock(stockItems).catch(() => {});
    throw err;
  }

  cart.items = [];
  cart.couponCode = null;
  cart.totalPriceInPaise = 0;
  await cart.save();

  // Confirmation email fires once Stripe confirms payment (see paymentController's
  // webhook handler) — sending it here, before payment, would be misleading.
  checkAndAlertLowStock(stockItems.map((item) => item.product)).catch(() => {});

  res.status(201).json(new ApiResponse(201, order, 'Order created — proceed to payment'));
});

// @desc    Get logged in user's order history (paginated)
// @route   GET /api/v1/orders/myorders
export const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'User orders retrieved successfully')
  );
});

// @desc    Get single order details by ID
// @route   GET /api/v1/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const orderOwnerId = order.user?._id?.toString();
  if (orderOwnerId && orderOwnerId !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this order');
  }

  res.status(200).json(new ApiResponse(200, order, 'Order retrieved successfully'));
});

// @desc    Customer requests a return on a delivered order (within 7 days)
// @route   POST /api/v1/orders/:id/request-return
export const requestReturn = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) throw new ApiError(404, 'Order not found');
  if (order.user?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to modify this order');
  }
  if (order.status !== 'DELIVERED') {
    throw new ApiError(400, 'Only delivered orders can be returned');
  }
  const daysSinceDelivery = order.deliveredAt
    ? (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  if (daysSinceDelivery > 7) {
    throw new ApiError(400, 'The 7-day return window for this order has passed');
  }

  order.status = 'RETURN_REQUESTED';
  order.timeline.push({ status: 'RETURN_REQUESTED', timestamp: new Date(), note: reason });
  await order.save();

  sendOrderStatusEmail(order, req.user.email, `Return requested: ${reason}`).catch(() => {});

  res.status(200).json(new ApiResponse(200, order, 'Return requested — an admin will review it shortly'));
});

// @desc    Admin: list orders (paginated, optional status filter)
// @route   GET /api/v1/orders/admin/all
export const adminListOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Orders retrieved')
  );
});

// @desc    Admin: update order status/tracking, appends a timeline entry
// @route   PATCH /api/v1/orders/admin/:id/status
export const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note, trackingNumber } = req.body;
  const order = await Order.findById(req.params.id).populate('user', 'email');

  if (!order) throw new ApiError(404, 'Order not found');

  // Stock is reserved at order-creation time (not at payment), so cancelling an
  // unpaid order must release it back — otherwise abandoned checkouts hold stock forever.
  if (status === 'CANCELLED' && order.status !== 'CANCELLED' && !order.isPaid) {
    await restoreStock(
      order.orderItems.map((item) => ({ product: item.product, sku: item.variantSku, quantity: item.quantity }))
    ).catch((err) => logger.error('restock_on_cancel_failed', { error: err.message }));
  }

  order.status = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  order.timeline.push({ status, timestamp: new Date(), note: note || '' });
  await order.save();

  const recipientEmail = order.user?.email || order.guestEmail;
  if (recipientEmail) {
    sendOrderStatusEmail(order, recipientEmail, note).catch(() => {});
  }

  res.status(200).json(new ApiResponse(200, order, 'Order status updated'));
});

// @desc    Admin: approve a return request, refund via Stripe if the order was paid, restock items
// @route   POST /api/v1/orders/admin/:id/approve-return
export const adminApproveReturn = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'email');

  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'RETURN_REQUESTED') {
    throw new ApiError(400, 'Order is not in a return-requested state');
  }

  let refunded = false;
  if (order.isPaid && order.paymentIntentId) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.refunds.create({ payment_intent: order.paymentIntentId });
        refunded = true;
      } catch (err) {
        logger.error('stripe_refund_failed', { orderId: order._id.toString(), error: err.message });
      }
    }
  }

  await restoreStock(
    order.orderItems.map((item) => ({ product: item.product, sku: item.variantSku, quantity: item.quantity }))
  ).catch((err) => logger.error('restock_on_return_failed', { error: err.message }));

  if (refunded) {
    // Void any seller ledger entries this order created — a refunded sale
    // earns the seller nothing. Entries already `paid_out` are left alone
    // (that settlement already happened off-platform; reconciling it is a
    // manual admin/accounting step, not something this endpoint can undo).
    await SellerTransaction.updateMany(
      { order: order._id, status: { $in: ['pending', 'available'] } },
      { status: 'reversed' }
    ).catch((err) => logger.error('seller_transaction_reversal_failed', { orderId: order._id.toString(), error: err.message }));
  }

  order.status = refunded ? 'REFUNDED' : 'RETURNED';
  order.paymentStatus = refunded ? 'Refunded' : order.paymentStatus;
  order.timeline.push({
    status: order.status,
    timestamp: new Date(),
    note: refunded ? 'Return approved and refunded via Stripe.' : 'Return approved.',
  });
  await order.save();

  const recipientEmail = order.user?.email || order.guestEmail;
  if (recipientEmail) {
    sendOrderStatusEmail(order, recipientEmail, refunded ? 'Your refund has been processed.' : 'Your return has been approved.').catch(() => {});
  }

  res.status(200).json(new ApiResponse(200, order, 'Return processed'));
});
