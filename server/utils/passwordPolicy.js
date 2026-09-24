// Shared between the Zod validator and anywhere else that needs to describe
// the policy in copy (e.g. the frontend strength meter mirrors this, but
// enforcement only ever happens here — the frontend check is UX only).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// At least one letter and one number — a reasonable floor against trivially
// weak passwords ("12345678") without the false security of an arbitrarily
// strict character-class rule that mostly just pushes people toward
// predictable substitutions ("Password1!").
const HAS_LETTER = /[A-Za-z]/;
const HAS_NUMBER = /\d/;

export function isPasswordStrongEnough(password) {
  return (
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    HAS_LETTER.test(password) &&
    HAS_NUMBER.test(password)
  );
}

export const PASSWORD_POLICY_MESSAGE = `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and include at least one letter and one number.`;
