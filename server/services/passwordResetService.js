import crypto from 'crypto';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Exported so the controller can look a user up BY this hash (the only way
// to find which user a raw token belongs to without storing the raw value).
export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Generates a cryptographically random, single-use reset token. Only its
// hash is ever persisted (mirrors the deleted otpService.js's proven
// pattern) — the raw value exists only in memory long enough to email it,
// and is never logged or returned by any API response.
export async function issuePasswordResetToken(user) {
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();
  return rawToken;
}

// Timing-safe compare of the incoming token's hash against the stored one,
// plus expiry — does not consume the token (see consumePasswordResetToken).
export function isPasswordResetTokenValid(user, rawToken) {
  if (!user?.passwordResetTokenHash || !user.passwordResetExpires) return false;
  if (user.passwordResetExpires.getTime() < Date.now()) return false;

  const incomingHash = Buffer.from(hashResetToken(rawToken));
  const storedHash = Buffer.from(user.passwordResetTokenHash);
  if (incomingHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(incomingHash, storedHash);
}

// Clears the token fields so it can never be used a second time — called
// only after a successful reset.
export function clearPasswordResetToken(user) {
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
}
