import User from '../models/User.js';
import { getFirebaseAuth, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { recordAuditLog } from './auditLogService.js';
import logger from '../utils/logger.js';

export { isFirebaseConfigured };

// Verifies a Firebase ID token server-side — this is the one security-
// critical step: the client can send anything it wants, but only a token
// Firebase itself signed (proven via Google's public keys, checked inside
// the Admin SDK) will verify. The returned `uid`/`phoneNumber` are exactly
// what Firebase's own servers attest to; nothing here trusts a
// client-asserted phone number directly.
export async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAuth();
  if (!auth) {
    const err = new Error('Phone sign-in is not configured.');
    err.code = 'FIREBASE_UNAVAILABLE';
    err.statusCode = 503;
    throw err;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.phone_number) {
      const err = new Error('This sign-in method requires a phone-verified Firebase account.');
      err.statusCode = 400;
      throw err;
    }
    return { uid: decoded.uid, phoneNumber: decoded.phone_number };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.warn('firebase_token_verification_failed', { error: error.message });
    const err = new Error('Invalid or expired sign-in session. Please try again.');
    err.statusCode = 401;
    throw err;
  }
}

// Finds the returning Firebase-auth user, claims a pre-existing legacy
// account with a matching phone number, or creates a brand new account.
//
// Firebase Phone Auth is now the ONLY way to sign in — there is no email/
// password fallback left to redirect a conflicting legacy account to, so
// leaving that phone number permanently unreachable is not an option. A
// verified phone number matching an existing account that has never been
// claimed (no firebaseUid yet) is attached to that account, one-time, and
// recorded to AuditLog. This is deliberately NOT a blind merge: Firebase has
// cryptographically proven the caller possesses this exact phone number via
// a real SMS code, which is a materially stronger signal than the
// client-asserted match this rule would otherwise be. It only ever applies
// to an account with no other login path left — an already-claimed account
// (firebaseUid already set) is never touched by this branch. See
// docs/FIREBASE_AUTH.md for the full rationale.
export async function findOrCreateUserFromFirebase({ uid, phoneNumber, name }) {
  const existing = await User.findOne({ firebaseUid: uid });
  if (existing) {
    if (!existing.isActive) {
      const err = new Error('This account has been deactivated. Contact an administrator.');
      err.statusCode = 403;
      throw err;
    }
    return existing;
  }

  // First time this Firebase identity has reached the backend — check for a
  // pre-existing account that already lists this phone number but has never
  // been claimed by any Firebase identity.
  const unclaimed = await User.findOne({ phone: phoneNumber, firebaseUid: { $exists: false } });
  if (unclaimed) {
    if (!unclaimed.isActive) {
      const err = new Error('This account has been deactivated. Contact an administrator.');
      err.statusCode = 403;
      throw err;
    }
    unclaimed.firebaseUid = uid;
    unclaimed.phoneVerified = true;
    await unclaimed.save();
    await recordAuditLog({
      actor: unclaimed._id,
      action: 'user.firebase_phone_claimed',
      targetType: 'User',
      targetId: unclaimed._id,
      metadata: { firebaseUid: uid, phoneNumber },
    });
    return unclaimed;
  }

  // Phone sign-up never grants admin — role always defaults to 'customer'
  // regardless of anything the client sends (nothing client-supplied reaches
  // this function at all). `name` is the one client-supplied value used
  // here, and only here — a brand-new account with no name on file yet; it
  // is never applied to the existing/claim branches above, so a login can
  // never rename someone else's (or your own past) account.
  const user = await User.create({
    name: name?.trim() || 'AURA PRO Customer',
    phone: phoneNumber,
    firebaseUid: uid,
    phoneVerified: true,
    role: 'customer',
  });
  return user;
}
