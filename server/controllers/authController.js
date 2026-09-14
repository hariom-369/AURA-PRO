import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Register new user
// @route   POST /api/v1/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  const user = await User.create({ name, email, password });
  const token = user.generateAuthToken();

  const userPayload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  res
    .status(201)
    .json(new ApiResponse(201, { user: userPayload, token }, 'User registered successfully'));
});

// @desc    Authenticate user & get token
// @route   POST /api/v1/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = user.generateAuthToken();

  const userPayload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  res
    .status(200)
    .json(new ApiResponse(200, { user: userPayload, token }, 'Logged in successfully'));
});

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
export const getCurrentUser = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, req.user, 'User profile retrieved successfully'));
});