import Order from '../models/Order.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { getStripe, isStripeConfigured } from '../services/stripeClient.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';
import { recordSellerTransactionsForOrder } from '../services/sellerTransactionService.js';
import logger from '../utils/logger.js';

// @desc    Create a Stripe Checkout session for an already-created (PENDING) order,
//          using the order's own server-computed total — never a client-sent amount.
// @route   POST /api/v1/orders/:id/pay
export const createOrderPaymentSession = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Payment processing is not configured');
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.user?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to pay for this order');
  }
  if (order.isPaid) {
    throw new ApiError(400, 'This order has already been paid');
  }

  const stripe = getStripe();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    client_reference_id: order._id.toString(),
    metadata: { orderId: order._id.toString() },
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: { name: `AURA PRO Order ${order.orderNumber}` },
          unit_amount: order.totalPriceInPaise,
        },
        quantity: 1,
      },
    ],
    success_url: `${clientUrl}/orders/${order._id}?payment=success`,
    cancel_url: `${clientUrl}/orders/${order._id}?payment=cancelled`,
  });

  res.status(200).json(new ApiResponse(200, { url: session.url }, 'Checkout session created'));
});

// @desc    Stripe webhook — the only place that marks an order as paid.
// @route   POST /api/v1/webhooks/stripe
export const stripeWebhook = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).end();
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('stripe_webhook_signature_failed', { error: err.message });
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId || session.client_reference_id;

    if (orderId) {
      const order = await Order.findById(orderId).populate('user', 'email');
      if (order && !order.isPaid) {
        order.paymentStatus = 'Completed';
        order.status = 'CONFIRMED';
        order.paymentIntentId = session.payment_intent || null;
        order.paymentResult = {
          id: session.id,
          status: session.payment_status,
          updateTime: new Date().toISOString(),
          emailAddress: session.customer_details?.email || '',
        };
        order.timeline.push({ status: 'CONFIRMED', timestamp: new Date(), note: 'Payment confirmed via Stripe.' });
        await order.save();

        // Awaited (unlike the confirmation email below) — a seller's earnings
        // record is financial state, not a best-effort notification, and the
        // `!order.isPaid` guard above means a retry would never get a second
        // chance to write it once the order itself is already marked paid.
        try {
          await recordSellerTransactionsForOrder(order);
        } catch (err) {
          logger.error('seller_transactions_failed', { orderId: order._id.toString(), error: err.message });
        }

        const recipientEmail = order.user?.email || order.guestEmail;
        if (recipientEmail) {
          sendOrderConfirmationEmail(order, recipientEmail).catch((err) =>
            logger.error('order_confirmation_email_failed', { error: err.message })
          );
        }
      }
    }
  }

  res.status(200).json({ received: true });
});
