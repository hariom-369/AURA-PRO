import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const calculateTotal = (items) =>
  items.reduce((acc, item) => acc + item.price * item.quantity, 0);

// @desc    Get current user's cart
// @route   GET /api/v1/cart
export const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate(
    'items.product',
    'name slug primaryImage stock'
  );

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [], totalPrice: 0 });
  }

  res.status(200).json(new ApiResponse(200, cart, 'Cart retrieved successfully'));
});

// @desc    Add an item, or adjust an existing item's quantity by a signed delta
//          (a delta that brings quantity to 0 or below removes the item)
// @route   POST /api/v1/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const delta = Number(quantity);

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingItemIndex > -1) {
    const newQuantity = cart.items[existingItemIndex].quantity + delta;
    if (newQuantity <= 0) {
      cart.items.splice(existingItemIndex, 1);
    } else {
      if (newQuantity > product.stock) {
        throw new ApiError(400, 'Requested quantity exceeds available stock');
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    }
  } else {
    if (delta <= 0) {
      throw new ApiError(400, 'Invalid quantity');
    }
    if (delta > product.stock) {
      throw new ApiError(400, 'Requested quantity exceeds available stock');
    }
    cart.items.push({
      product: productId,
      quantity: delta,
      price: product.price,
    });
  }

  cart.totalPrice = calculateTotal(cart.items);
  await cart.save();

  res.status(200).json(new ApiResponse(200, cart, 'Cart updated successfully'));
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/:productId
export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  cart.items = cart.items.filter((item) => item.product.toString() !== productId);
  cart.totalPrice = calculateTotal(cart.items);
  await cart.save();

  res.status(200).json(new ApiResponse(200, cart, 'Item removed from cart successfully'));
});