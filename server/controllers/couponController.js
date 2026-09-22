import Coupon from '../models/Coupon.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Admin: list coupons (paginated)
// @route   GET /api/v1/admin/coupons
export const adminListCoupons = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [coupons, total] = await Promise.all([
    Coupon.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments({}),
  ]);

  res.status(200).json(
    new ApiResponse(200, { coupons, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Coupons retrieved')
  );
});

// @desc    Admin: create a coupon
// @route   POST /api/v1/admin/coupons
export const adminCreateCoupon = asyncHandler(async (req, res) => {
  const existing = await Coupon.findOne({ code: req.body.code.toUpperCase() });
  if (existing) throw new ApiError(409, 'A coupon with this code already exists');

  const coupon = await Coupon.create(req.body);
  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created'));
});

// @desc    Admin: update a coupon (including activate/deactivate)
// @route   PATCH /api/v1/admin/coupons/:id
export const adminUpdateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  Object.assign(coupon, req.body);
  await coupon.save();

  res.status(200).json(new ApiResponse(200, coupon, 'Coupon updated'));
});

// @desc    Admin: delete a coupon
// @route   DELETE /api/v1/admin/coupons/:id
export const adminDeleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  res.status(200).json(new ApiResponse(200, null, 'Coupon deleted'));
});
