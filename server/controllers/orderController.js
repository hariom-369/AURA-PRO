import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Create new order from user's current cart
// @route   POST /api/v1/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;

  if (!shippingAddress || !shippingAddress.address || !shippingAddress.city) {
    throw new ApiError(400, 'Please provide full shipping address details');
  }

  // Retrieve user's cart
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty');
  }

  // Verify product stock & prepare order items
  const orderItems = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.product._id);
    if (!product || product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Stock issue: ${item.product.name} only has ${product ? product.stock : 0} left.`
      );
    }
    
    orderItems.push({
      name: product.name,
      quantity: item.quantity,
      price: product.price,
      product: product._id,
    });
  }

  // Price calculations
  const itemsPrice = cart.totalPrice;
  const taxPrice = Number((itemsPrice * 0.1).toFixed(2)); // 10% tax rate
  const shippingPrice = itemsPrice > 100 ? 0 : 10; // Free shipping over $100
  const totalPrice = Number((itemsPrice + taxPrice + shippingPrice).toFixed(2));

  // Create order
  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethod: paymentMethod || 'Stripe',
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  // Deduct stock levels for purchased items
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity },
    });
  }

  // Clear user cart after placing order
  cart.items = [];
  cart.totalPrice = 0;
  await cart.save();

  res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});

// @desc    Get logged in user's order history
// @route   GET /api/v1/orders/myorders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, orders, 'User orders retrieved successfully'));
});

// @desc    Get single order details by ID
// @route   GET /api/v1/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  // Ensure user owns order or is an admin
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this order');
  }

  res.status(200).json(new ApiResponse(200, order, 'Order retrieved successfully'));
});