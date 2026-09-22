import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import {
  generateAndSendOtp,
  verifyOtp,
  verifyPendingToken,
  issuePendingToken,
  generateCode,
  isDevFallbackAllowed,
} from '../services/otpService.js';
import {
  createPendingRegistration,
  verifyPendingRegistration,
  resendPendingRegistrationOtp,
} from '../services/pendingRegistrationService.js';

// Timing-safe comparison (hashes both sides to a fixed length first, so it
// works regardless of input length and doesn't leak length via timing).
function safeCompare(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function toUserPayload(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role };
}

function otpRethrow(error) {
  if (error.statusCode) throw new ApiError(error.statusCode, error.message);
  throw error;
}

// @desc    Start registration (step 1 of 2). No User document is created
//          here — an OTP is emailed and the submitted details (password
//          already hashed) are held in PendingRegistration until the code is
//          confirmed via verify-signup-otp. Only a verified email ever
//          produces a real account. Supplying a valid `adminCode` (matching
//          ADMIN_SIGNUP_CODE) grants the admin role; anyone without it gets a
//          customer account — no error or hint is given either way.
// @route   POST /api/v1/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, adminCode } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  const isAdminSignup =
    Boolean(adminCode) && Boolean(process.env.ADMIN_SIGNUP_CODE) && safeCompare(adminCode, process.env.ADMIN_SIGNUP_CODE);

  try {
    const { pendingToken, devCode, emailSent } = await createPendingRegistration({
      name,
      email,
      password,
      phone,
      role: isAdminSignup ? 'admin' : 'customer',
    });
    res.status(200).json(
      new ApiResponse(
        200,
        { pendingToken, email, devCode, emailSent },
        'Enter the verification code sent to your email to finish creating your account.'
      )
    );
  } catch (error) {
    otpRethrow(error);
  }
});

// @desc    Step 1 of login: verify identifier (email or mobile number) +
//          password, then email a login OTP instead of issuing an access
//          token directly.
// @route   POST /api/v1/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    throw new ApiError(400, 'Please provide your email/mobile number and password');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }
  // Every real User document is created only after OTP verification (see
  // registerUser/verifyPendingRegistration) — isEmailVerified should always
  // be true here. Guard defensively rather than silently mis-routing.
  if (!user.isEmailVerified) {
    throw new ApiError(403, 'This account never completed email verification. Please register again.');
  }

  try {
    const { pendingToken, devCode, emailSent } = await generateAndSendOtp(user, 'LOGIN');
    res.status(200).json(
      new ApiResponse(
        200,
        { pendingToken, purpose: 'LOGIN', email: user.email, devCode, emailSent },
        'Enter the code sent to your email to finish signing in.'
      )
    );
  } catch (error) {
    otpRethrow(error);
  }
});

// @desc    Step 2 of signup: confirm the emailed OTP. Only on success is the
//          real User document created (from the held PendingRegistration) —
//          the account never exists in the database before this point.
// @route   POST /api/v1/auth/verify-signup-otp
export const verifySignupOtp = asyncHandler(async (req, res) => {
  const { pendingToken, code } = req.body;

  let user;
  try {
    user = await verifyPendingRegistration(pendingToken, code);
  } catch (error) {
    otpRethrow(error);
  }

  const token = user.generateAuthToken();
  res.status(201).json(new ApiResponse(201, { user: toUserPayload(user), token }, 'Email verified — welcome to AURA PRO!'));
});

// @desc    Step 2 of login: confirm the emailed OTP and issue the real
//          access token.
// @route   POST /api/v1/auth/verify-login-otp
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { pendingToken, code } = req.body;

  let userId;
  try {
    userId = await verifyOtp(pendingToken, code, 'LOGIN');
  } catch (error) {
    otpRethrow(error);
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');

  const token = user.generateAuthToken();
  res.status(200).json(new ApiResponse(200, { user: toUserPayload(user), token }, 'Logged in successfully'));
});

// @desc    Resend the OTP for a pending signup-verification or login session.
// @route   POST /api/v1/auth/resend-otp
export const resendOtp = asyncHandler(async (req, res) => {
  const { pendingToken, purpose } = req.body;
  if (!pendingToken || !['SIGNUP_VERIFICATION', 'LOGIN', 'PASSWORD_RESET'].includes(purpose)) {
    throw new ApiError(400, 'A pending token and valid purpose are required');
  }

  try {
    if (purpose === 'SIGNUP_VERIFICATION') {
      const { pendingToken: newPendingToken, devCode, emailSent } = await resendPendingRegistrationOtp(pendingToken);
      return res
        .status(200)
        .json(new ApiResponse(200, { pendingToken: newPendingToken, devCode, emailSent }, 'A new code has been sent to your email.'));
    }

    const userId = verifyPendingToken(pendingToken, purpose);
    const user = await User.findById(userId);

    // PASSWORD_RESET pendingTokens can legitimately reference no real user
    // (see forgotPassword's inert-token branch) — the response must stay
    // identical either way, or resend becomes an enumeration oracle.
    if (!user) {
      if (purpose === 'PASSWORD_RESET') {
        const reissued = issuePendingToken(userId, purpose);
        const devCode = isDevFallbackAllowed() ? generateCode() : undefined;
        return res
          .status(200)
          .json(new ApiResponse(200, { pendingToken: reissued, devCode, emailSent: true }, 'A new code has been sent to your email.'));
      }
      throw new ApiError(404, 'User not found');
    }

    const { pendingToken: newPendingToken, devCode, emailSent } = await generateAndSendOtp(user, purpose);
    res
      .status(200)
      .json(new ApiResponse(200, { pendingToken: newPendingToken, devCode, emailSent }, 'A new code has been sent to your email.'));
  } catch (error) {
    otpRethrow(error);
  }
});

// @desc    Start a password reset. Always responds the same way whether or
//          not the email belongs to an account — the response shape/status
//          must never reveal account existence. For a real, active account
//          this emails a real OTP; for anything else it issues an inert
//          pendingToken referencing no real OTP record, so a verify attempt
//          against it always (and only) fails with the ordinary "no active
//          code" error — indistinguishable from a real expired/wrong code.
// @route   POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericMessage = 'If an account exists for that email, a password reset code has been sent.';

  const user = await User.findOne({ email });
  if (user && user.isActive) {
    try {
      const { pendingToken, devCode, emailSent } = await generateAndSendOtp(user, 'PASSWORD_RESET');
      return res.status(200).json(new ApiResponse(200, { pendingToken, devCode, emailSent }, genericMessage));
    } catch (error) {
      // A genuine delivery failure (503) does surface differently than the
      // inert branch below — an accepted, documented gap in the
      // no-enumeration guarantee that only applies when SMTP itself is
      // broken (an operational fault, not the normal path).
      otpRethrow(error);
    }
  }

  // Match the real branch's response shape exactly in every environment —
  // including whether a `devCode` key is present — so the response can never
  // itself be used to distinguish "this email exists" from "it doesn't."
  const inertToken = issuePendingToken(new mongoose.Types.ObjectId(), 'PASSWORD_RESET');
  const devCode = isDevFallbackAllowed() ? generateCode() : undefined;
  res.status(200).json(new ApiResponse(200, { pendingToken: inertToken, devCode, emailSent: true }, genericMessage));
});

// @desc    Complete a password reset: confirm the emailed OTP, then set the
//          new password.
// @route   POST /api/v1/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { pendingToken, code, newPassword } = req.body;

  let userId;
  try {
    userId = await verifyOtp(pendingToken, code, 'PASSWORD_RESET');
  } catch (error) {
    otpRethrow(error);
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(400, 'This reset session is no longer valid. Please start again.');

  user.password = newPassword;
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password reset successfully. You can now log in with your new password.'));
});

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

  const userPayload = user.toObject();
  delete userPayload.password;

  res.status(200).json(new ApiResponse(200, userPayload, 'Profile updated'));
});

// @desc    Change the logged-in user's own password
// @route   POST /api/v1/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
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