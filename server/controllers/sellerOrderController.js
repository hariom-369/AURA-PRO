import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// Never return another seller's line items or pricing alongside this
// seller's own order view — a shared multi-vendor order is filtered down to
// only the requesting seller's items before it ever leaves the server.
function scopeOrderToSeller(order, sellerId) {
  const obj = order.toObject();
  obj.orderItems = obj.orderItems.filter((item) => item.seller && item.seller.toString() === sellerId.toString());
  return obj;
}

// @desc    Seller: list orders containing at least one of their own items
//          (paid orders only — unpaid/abandoned checkouts aren't real sales yet)
// @route   GET /api/v1/seller/orders
export const sellerListOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = { 'orderItems.seller': req.seller._id, isPaid: true };

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { orders: orders.map((o) => scopeOrderToSeller(o, req.seller._id)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      'Your orders retrieved'
    )
  );
});

// @desc    Seller: view one order, scoped to their own items only
// @route   GET /api/v1/seller/orders/:orderId
export const sellerGetOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, 'orderItems.seller': req.seller._id, isPaid: true });
  if (!order) throw new ApiError(404, 'Order not found');
  res.status(200).json(new ApiResponse(200, scopeOrderToSeller(order, req.seller._id), 'Order retrieved'));
});

// @desc    Seller: update the fulfillment status of one of their own line
//          items — independent of the order-wide status, which stays under
//          admin/payment control.
// @route   PATCH /api/v1/seller/orders/:orderId/items/:itemId/fulfillment
export const sellerUpdateItemFulfillment = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const item = order.orderItems.id(req.params.itemId);
  if (!item || !item.seller || item.seller.toString() !== req.seller._id.toString()) {
    throw new ApiError(403, 'You do not have access to this order item');
  }

  item.fulfillmentStatus = status;
  order.timeline.push({ status: `SELLER_ITEM_${status}`, timestamp: new Date(), note: `"${item.name}" marked ${status} by seller` });
  await order.save();

  res.status(200).json(new ApiResponse(200, scopeOrderToSeller(order, req.seller._id), 'Fulfillment status updated'));
});
