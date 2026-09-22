import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { recordAuditLog } from '../services/auditLogService.js';

// @desc    Admin: list users (paginated, optional search/role filter)
// @route   GET /api/v1/admin/users
export const adminListUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const term = req.query.search.trim();
    filter.$or = [
      { name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { email: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Users retrieved')
  );
});

// @desc    Admin: promote/demote a user's role
// @route   PATCH /api/v1/admin/users/:id/role
export const adminUpdateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  const user = await User.findById(req.params.id).select('-password');
  if (!user) throw new ApiError(404, 'User not found');

  const previousRole = user.role;
  user.role = role;
  await user.save();

  await recordAuditLog({
    actor: req.user._id,
    action: 'user.role_change',
    targetType: 'User',
    targetId: user._id,
    metadata: { from: previousRole, to: role },
  });

  res.status(200).json(new ApiResponse(200, user, `User role updated to ${role}`));
});

// @desc    Admin: activate/deactivate a user account
// @route   PATCH /api/v1/admin/users/:id/status
export const adminUpdateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await User.findById(req.params.id).select('-password');
  if (!user) throw new ApiError(404, 'User not found');

  user.isActive = isActive;
  await user.save();

  await recordAuditLog({
    actor: req.user._id,
    action: 'user.status_change',
    targetType: 'User',
    targetId: user._id,
    metadata: { isActive },
  });

  res.status(200).json(new ApiResponse(200, user, `User ${isActive ? 'activated' : 'deactivated'}`));
});
