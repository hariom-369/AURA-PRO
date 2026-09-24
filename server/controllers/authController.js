import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { verifyGoogleIdToken } from '../services/googleAuthService.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { issuePasswordResetToken, hashResetToken, isPasswordResetTokenValid, clearPasswordResetToken } from '../services/passwordResetService.js';

export function toUserPayload(user, { hasPassword } = {}) {
  const payload = { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role, hasGoogleLinked: Boolean(user.googleId) };
  if (hasPassword !== undefined) payload.hasPassword = hasPassword;
  return payload;
}

// A lightweight existence check rather than re-fetching the whole document
// with `.select('+password')` — password's value is never read, only
// whether the field is set, so this never risks returning a hash anywhere.
async function hasPasswordSet(userId) {
  return Boolean(await User.exists({ _id: userId, password: { $exists: true, $ne: null } }));
}

// @desc    Register a new account (email + password). Role always defaults
//          to 'customer' — there is no client-supplied role of any kind
//          here; becoming a seller is the existing, separate onboarding/
//          approval flow (see server/routes/sellerRoutes.js), unaffected
//          by how someone signed up.
// @route   POST /api/v1/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    const message = existing.googleId && !(await hasPasswordSet(existing._id))
      ? 'This email is linked to a Google account. Sign in with Google, or use "Forgot password" to add a password.'
      : 'An account with this email already exists. Please sign in instead.';
    throw new ApiError(409, message);
  }

  // Password hashing happens in User's pre('save') hook.
  const user = await User.create({ name, email, password, role: 'customer' });

  const token = user.generateAuthToken();
  res.status(201).json(new ApiResponse(201, { user: toUserPayload(user, { hasPassword: true }), token }, 'Account created'));
});

// @desc    Sign in with email + password.
// @route   POST /api/v1/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Deliberately generic: whether the email doesn't exist, has no password
  // (Google-only account), or the password is simply wrong, the response
  // is identical — never reveals which case it was.
  const genericError = () => new ApiError(401, 'Invalid email or password.');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw genericError();
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }

  const token = user.generateAuthToken(rememberMe ? '30d' : '1d');
  res.status(200).json(new ApiResponse(200, { user: toUserPayload(user, { hasPassword: true }), token }, 'Signed in successfully'));
});

// @desc    Start a password reset. Always responds the same way whether or
//          not the email belongs to an account — response shape/status must
//          never reveal account existence.
// @route   POST /api/v1/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

  const user = await User.findOne({ email });
  if (user && user.isActive) {
    const rawToken = await issuePasswordResetToken(user);
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${rawToken}`;
    // Best-effort, like every other transactional email in this app — a
    // delivery failure here still returns the same generic response (see
    // docs/AUTHENTICATION.md for why that's an accepted, documented gap).
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  res.status(200).json(new ApiResponse(200, null, genericMessage));
});

// @desc    Complete a password reset with a valid, unexpired, single-use
//          token. Looked up by the token's hash — the raw token itself is
//          never stored anywhere, only emailed once.
// @route   POST /api/v1/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({ passwordResetTokenHash: hashResetToken(token) }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user || !isPasswordResetTokenValid(user, token)) {
    throw new ApiError(400, 'This password reset link is invalid or has expired. Please request a new one.');
  }

  user.password = password; // re-hashed by the pre('save') hook
  clearPasswordResetToken(user);
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password reset successfully. You can now log in with your new password.'));
});

// @desc    Change the logged-in user's own password.
// @route   POST /api/v1/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
});

// @desc    Sign in or sign up with a verified Google identity. Never trusts
//          a client-asserted id/email/role — the ID token is verified
//          server-side first. Never auto-merges into an existing password
//          account with a matching email (see docs/AUTHENTICATION.md); role
//          always defaults to 'customer' on creation, same as email/password.
// @route   POST /api/v1/auth/google
export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const { googleId, email, name } = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ googleId });
  if (!user) {
    const existingByEmail = await User.findOne({ email });
    if (existingByEmail) {
      throw new ApiError(
        409,
        'An account with this email already exists. Sign in with your password, then link Google from your profile settings.'
      );
    }
    user = await User.create({ name: name || 'AURA PRO Customer', email, googleId, role: 'customer' });
  }

  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }

  const token = user.generateAuthToken();
  const hasPassword = await hasPasswordSet(user._id);
  res.status(200).json(new ApiResponse(200, { user: toUserPayload(user, { hasPassword }), token }, 'Signed in with Google'));
});

// @desc    Link a verified Google identity to the logged-in user's existing
//          account. Requires the caller to already be authenticated via
//          their existing credential first — this IS the "reauthentication
//          before linking" step; there is no unauthenticated linking path.
// @route   POST /api/v1/auth/me/link-google
export const linkGoogleAccount = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const { googleId } = await verifyGoogleIdToken(idToken);

  const user = await User.findById(req.user._id);
  if (user.googleId) {
    throw new ApiError(400, 'This account already has a linked Google account.');
  }
  const alreadyLinkedElsewhere = await User.findOne({ googleId });
  if (alreadyLinkedElsewhere) {
    throw new ApiError(409, 'This Google account is already linked to a different AURA PRO account.');
  }

  user.googleId = googleId;
  await user.save();

  const hasPassword = await hasPasswordSet(user._id);
  res.status(200).json(new ApiResponse(200, toUserPayload(user, { hasPassword }), 'Google account linked'));
});

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
export const getCurrentUser = asyncHandler(async (req, res) => {
  const hasPassword = await hasPasswordSet(req.user._id);
  res.status(200).json(new ApiResponse(200, toUserPayload(req.user, { hasPassword }), 'User profile retrieved successfully'));
});

// @desc    Update the logged-in user's own name/phone
// @route   PATCH /api/v1/auth/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  const user = await User.findById(req.user._id);
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  const hasPassword = await hasPasswordSet(user._id);
  res.status(200).json(new ApiResponse(200, toUserPayload(user, { hasPassword }), 'Profile updated'));
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
