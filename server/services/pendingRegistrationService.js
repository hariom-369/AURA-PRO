import bcrypt from 'bcryptjs';
import PendingRegistration from '../models/PendingRegistration.js';
import User from '../models/User.js';
import { isEmailConfigured } from './emailService.js';
import {
  generateCode,
  hashCode,
  deliverOtpOrThrow,
  issuePendingToken,
  verifyPendingToken,
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
} from './otpService.js';

// A pending registration is discarded automatically (via the model's TTL
// index) if it's never verified — longer than one OTP's validity so a resend
// doesn't force the user to re-enter their whole form.
const PENDING_REGISTRATION_TTL_MINUTES = 30;

const SIGNUP_PURPOSE = 'SIGNUP_VERIFICATION';

function discardAtDate() {
  return new Date(Date.now() + PENDING_REGISTRATION_TTL_MINUTES * 60 * 1000);
}

// Step 1 of signup: no User document is created here. Registration details
// (with the password already bcrypt-hashed) are held in PendingRegistration
// until the OTP is verified — this is what guarantees no account ever lands
// in MongoDB before its email is confirmed.
export async function createPendingRegistration({ name, email, password, phone, role }) {
  const existing = await PendingRegistration.findOne({ email });
  if (existing && isEmailConfigured()) {
    const secondsSinceLast = (Date.now() - existing.updatedAt.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const err = new Error(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`
      );
      err.statusCode = 429;
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateCode();

  const pending = await PendingRegistration.findOneAndUpdate(
    { email },
    {
      name,
      email,
      passwordHash,
      phone: phone || '',
      role,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      discardAt: discardAtDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const { devCode, emailSent } = await deliverOtpOrThrow(email, code, SIGNUP_PURPOSE);
  return { pendingToken: issuePendingToken(pending._id, SIGNUP_PURPOSE), devCode, emailSent };
}

// Step 2 of signup: verifies the code, then — and only then — creates the
// real User document from the held registration details.
export async function verifyPendingRegistration(pendingToken, code) {
  const pendingId = verifyPendingToken(pendingToken, SIGNUP_PURPOSE);

  const pending = await PendingRegistration.findById(pendingId);
  if (!pending) {
    const err = new Error('This registration session has expired. Please sign up again.');
    err.statusCode = 400;
    throw err;
  }
  if (pending.expiresAt < new Date()) {
    const err = new Error('This code has expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.statusCode = 429;
    throw err;
  }

  if (hashCode(code) !== pending.codeHash) {
    pending.attempts += 1;
    await pending.save();
    const remaining = MAX_ATTEMPTS - pending.attempts;
    const err = new Error(
      remaining > 0 ? `Incorrect code. ${remaining} attempt(s) remaining.` : 'Incorrect code. Please request a new one.'
    );
    err.statusCode = 400;
    throw err;
  }

  // Re-check uniqueness at creation time, not just at form-submit time — an
  // identical email could have completed registration via a separate request
  // in between (e.g. two tabs racing).
  const alreadyExists = await User.findOne({ email: pending.email });
  if (alreadyExists) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    const err = new Error('An account with this email already exists. Please log in instead.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.create({
    name: pending.name,
    email: pending.email,
    password: pending.passwordHash, // already bcrypt-hashed; User's pre-save hook detects and skips re-hashing
    phone: pending.phone,
    role: pending.role,
    isEmailVerified: true,
  });

  await PendingRegistration.deleteOne({ _id: pending._id });

  return user;
}

// Resend for a pending (not-yet-created) registration.
export async function resendPendingRegistrationOtp(pendingToken) {
  const pendingId = verifyPendingToken(pendingToken, SIGNUP_PURPOSE);

  const pending = await PendingRegistration.findById(pendingId);
  if (!pending) {
    const err = new Error('This registration session has expired. Please sign up again.');
    err.statusCode = 400;
    throw err;
  }

  if (isEmailConfigured()) {
    const secondsSinceLast = (Date.now() - pending.updatedAt.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const err = new Error(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`
      );
      err.statusCode = 429;
      throw err;
    }
  }

  const code = generateCode();
  pending.codeHash = hashCode(code);
  pending.expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  pending.attempts = 0;
  pending.discardAt = discardAtDate();
  await pending.save();

  const { devCode, emailSent } = await deliverOtpOrThrow(pending.email, code, SIGNUP_PURPOSE);
  return { pendingToken: issuePendingToken(pending._id, SIGNUP_PURPOSE), devCode, emailSent };
}
