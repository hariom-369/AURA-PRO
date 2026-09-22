import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.js';
import { sendOtpEmail, isEmailConfigured } from './emailService.js';
import logger from '../utils/logger.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const PENDING_TOKEN_EXPIRY = '10m';

export function generateCode() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export { OTP_LENGTH, OTP_EXPIRY_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS };

// Exposed so callers that need to produce a dev-fallback-shaped response
// without an underlying OTP (e.g. forgotPassword's inert/non-existent-email
// branch, which must stay response-shape-identical to the real branch in
// every environment) can check the same two gates deliverOtpOrThrow uses.
export function isDevFallbackAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_FALLBACK !== 'false';
}

// Sends an OTP email and enforces the "never expose a code outside a real
// email in production" rule. Shared by every flow that needs to hand a code
// to a user (existing-user OTPs here, and pending-registration OTPs in
// pendingRegistrationService.js) so the safety gates only live in one place.
export async function deliverOtpOrThrow(email, code, purpose) {
  const emailResult = await sendOtpEmail(email, code, purpose);

  if (emailResult.success) {
    return { devCode: undefined, emailSent: true };
  }

  // Delivery failed. Two named, explicit gates must BOTH hold before the code
  // is ever exposed outside a real email — this is deliberately not just an
  // implicit NODE_ENV check, so "OTPs never leak in production" is auditable
  // as its own statement, not an accident of environment configuration:
  //   1. NODE_ENV must not be 'production' (hard-coded, not configurable)
  //   2. OTP_DEV_FALLBACK must not be explicitly 'false' (opt-out, defaults on in dev)
  if (!isDevFallbackAllowed()) {
    logger.error('otp_delivery_failed', { email, purpose, reason: emailResult.reason });
    const err = new Error(
      'We could not send your verification email right now. Please try again in a few minutes, or contact support if this continues.'
    );
    err.statusCode = 503;
    throw err;
  }

  logger.warn('otp_dev_fallback_no_smtp', { email, purpose, code });
  return { devCode: code, emailSent: false };
}

// A short-lived, single-purpose token proving "password already verified,
// waiting on OTP" (signup) or "waiting on 2FA code" (login). Deliberately
// shaped differently from a real access token (no `id` claim, has `type`)
// so authMiddleware.protect can never mistake one for the other.
export function issuePendingToken(userId, purpose) {
  return jwt.sign(
    { pendingUserId: userId.toString(), otpPurpose: purpose, type: 'otp_pending' },
    process.env.JWT_SECRET,
    { expiresIn: PENDING_TOKEN_EXPIRY }
  );
}

function verifyPendingToken(token, expectedPurpose) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('This verification session has expired. Please start again.');
    err.statusCode = 401;
    throw err;
  }
  if (decoded.type !== 'otp_pending' || decoded.otpPurpose !== expectedPurpose || !decoded.pendingUserId) {
    const err = new Error('Invalid verification session.');
    err.statusCode = 401;
    throw err;
  }
  return decoded.pendingUserId;
}

// Generates a new OTP, stores only its hash, emails it, and returns a pending
// token the client must present alongside the code to verify.
export async function generateAndSendOtp(user, purpose) {
  // The cooldown exists to stop real email spam/cost — it's meaningless (and
  // just adds friction) when SMTP isn't configured, since nothing is actually
  // being sent; the code is only logged/returned via the dev fallback below.
  if (isEmailConfigured()) {
    const recent = await Otp.findOne({ user: user._id, purpose }).sort({ createdAt: -1 });
    if (recent && !recent.consumedAt) {
      const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
        const err = new Error(
          `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`
        );
        err.statusCode = 429;
        throw err;
      }
    }
  }

  // Only the newest OTP per user+purpose is ever valid.
  await Otp.deleteMany({ user: user._id, purpose, consumedAt: null });

  const code = generateCode();
  await Otp.create({
    user: user._id,
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  const { devCode, emailSent } = await deliverOtpOrThrow(user.email, code, purpose);
  return { pendingToken: issuePendingToken(user._id, purpose), devCode, emailSent };
}

// Verifies a submitted code against the newest active OTP for the pending
// session. Returns the verified user's id on success.
export async function verifyOtp(pendingToken, code, purpose) {
  const userId = verifyPendingToken(pendingToken, purpose);

  const otp = await Otp.findOne({ user: userId, purpose, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp) {
    const err = new Error('No active verification code found. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }
  if (otp.expiresAt < new Date()) {
    const err = new Error('This code has expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.statusCode = 429;
    throw err;
  }

  if (hashCode(code) !== otp.codeHash) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_ATTEMPTS - otp.attempts;
    const err = new Error(
      remaining > 0 ? `Incorrect code. ${remaining} attempt(s) remaining.` : 'Incorrect code. Please request a new one.'
    );
    err.statusCode = 400;
    throw err;
  }

  otp.consumedAt = new Date();
  await otp.save();

  return userId;
}

export { verifyPendingToken };
