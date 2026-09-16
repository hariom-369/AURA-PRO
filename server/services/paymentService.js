const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { restoreStock } = require('./inventoryService');

const paymentService = {
  /**
   * Generates PaymentIntent server-side with strict backend pricing.
   */
  createPayment: async ({ orderId, amountInPaise, currency = 'inr', customerEmail }) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: currency.toLowerCase(),
      receipt_email: customerEmail,
      metadata: { orderId: orderId.toString() },
      automatic_payment_methods: { enabled: true }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  },

  /**
   * Webhook Signature Verification & Event Execution (Idempotent)
   */
  handleWebhookEvent: async (rawBody, signature) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      throw new Error(`Webhook Signature Verification Failed: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;

      const order = await Order.findById(orderId);
      if (!order) return { status: 'ORDER_NOT_FOUND' };

      // Prevent duplicate event processing
      if (order.paymentInfo.status === 'PAID') {
        return { status: 'ALREADY_PROCESSED' };
      }

      order.paymentInfo.status = 'PAID';
      order.paymentInfo.paidAt = new Date();
      order.status = 'CONFIRMED';
      order.timeline.push({ status: 'CONFIRMED', note: 'Payment verified via Stripe Webhook.' });

      await order.save();
      return { status: 'SUCCESS' };
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;

      const order = await Order.findById(orderId);
      if (order && order.paymentInfo.status !== 'PAID') {
        order.paymentInfo.status = 'FAILED';
        order.status = 'CANCELLED';
        order.timeline.push({ status: 'CANCELLED', note: 'Payment failed during authorization.' });
        await order.save();
        await restoreStock(order.items);
      }
    }

    return { status: 'EVENT_HANDLED' };
  },

  refundPayment: async (paymentIntentId, amountInPaise) => {
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInPaise
    });
  }
};

module.exports = paymentService;