import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

export function toUserPayload(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role };
}

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
export const getCurrentUser = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, req.user, 'User profile retrieved successfully'));
});

// @desc    Update the logged-in user's own name/phone
// @route   PATCH /api/v1/auth/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  const user = await User.findById(req.user._id);
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  res.status(200).json(new ApiResponse(200, user.toObject(), 'Profile updated'));
});

// @desc    Upload/replace the logged-in user's avatar
// @route   POST /api/v1/auth/me/avatar
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Image upload is not configured (missing Cloudinary credentials)');
  }
  if (!req.file) {
    throw new ApiError(400, 'No image file provided');
  }

  const cloudinary = getCloudinary();
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'aura-pro/avatars', resource_type: 'image' },
      (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
    );
    stream.end(req.file.buffer);
  });

  const user = await User.findById(req.user._id);
  user.avatar = result.secure_url;
  await user.save();

  res.status(200).json(new ApiResponse(200, { avatar: user.avatar }, 'Avatar updated'));
});
