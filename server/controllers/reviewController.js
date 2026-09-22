import Review from '../models/Review.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    List reviews for a product (paginated)
// @route   GET /api/v1/reviews/product/:productId
export const getProductReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { product: req.params.productId };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      'Reviews retrieved'
    )
  );
});

// @desc    Create a review for a product (one per user per product)
// @route   POST /api/v1/reviews
export const createReview = asyncHandler(async (req, res) => {
  const { product, rating, title, comment } = req.body;

  const existing = await Review.findOne({ product, user: req.user._id });
  if (existing) {
    throw new ApiError(409, 'You have already reviewed this product');
  }

  const purchaseOrder = await Order.findOne({
    user: req.user._id,
    'orderItems.product': product,
    status: { $ne: 'CANCELLED' },
  }).select('_id');

  const review = await Review.create({
    product,
    user: req.user._id,
    order: purchaseOrder?._id || null,
    rating,
    title,
    comment,
    isVerifiedPurchase: Boolean(purchaseOrder),
  });

  await review.populate('user', 'name avatar');

  res.status(201).json(new ApiResponse(201, review, 'Review submitted'));
});

// @desc    Delete a review (owner or admin)
// @route   DELETE /api/v1/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this review');
  }

  await Review.findOneAndDelete({ _id: review._id });

  res.status(200).json(new ApiResponse(200, null, 'Review deleted'));
});
