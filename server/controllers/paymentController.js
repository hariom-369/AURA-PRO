import Stripe from 'stripe';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    throw new ApiError(400, 'Cart is empty');
  }

  const lineItems = items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.name,
        images: item.product.imageUrl ? [item.product.imageUrl] : [],
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?payment=success`,
    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?payment=canceled`,
  });

  res.status(200).json(new ApiResponse(200, { url: session.url }, 'Checkout session created'));
});