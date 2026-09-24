// Strips everything but digits from a raw, user-typed national number.
function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

// Builds an E.164-ish string ("+<dialCode digits><national digits>") to hand
// to Firebase. Firebase itself is the authoritative validator — this just
// avoids sending obviously-malformed input (spaces, dashes, parens).
export function normalizePhoneNumber(dialCode, rawNumber) {
  return `${dialCode}${digitsOnly(rawNumber)}`;
}

// A loose sanity check, not a real phone-number validation library — real
// validation happens server-side via Firebase (auth/invalid-phone-number).
// This only catches empty/obviously-too-short-or-long input before
// bothering to start a verification request at all.
export function isValidNationalNumber(rawNumber) {
  const digits = digitsOnly(rawNumber);
  return digits.length >= 6 && digits.length <= 14;
}

// Privacy-conscious display: dial code + the number with all but the last
// two digits masked, e.g. "+91 ••••••••10".
export function maskPhoneForDisplay(dialCode, rawNumber) {
  const digits = digitsOnly(rawNumber);
  if (digits.length <= 2) return `${dialCode} ${digits}`;
  const masked = '•'.repeat(digits.length - 2) + digits.slice(-2);
  return `${dialCode} ${masked}`;
}
