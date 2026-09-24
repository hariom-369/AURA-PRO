// Maps Firebase Auth error codes to short, user-facing copy — never shows a
// raw "Firebase: Error (auth/xxx)." string or a stack trace. Firebase JS SDK
// errors carry the code as `error.code`; anything unrecognized (including
// plain network failures, which don't have an auth/* code) falls back to a
// generic, still-actionable message.
const MESSAGES = {
  'auth/invalid-phone-number': 'That phone number doesn’t look valid. Check the country code and number, then try again.',
  'auth/too-many-requests': 'Too many attempts from this device. Please wait a while before trying again.',
  'auth/quota-exceeded': 'We’ve hit our SMS sending limit for now. Please try again later.',
  'auth/operation-not-allowed': 'Phone sign-in isn’t enabled for this app right now. Please contact support.',
  'auth/invalid-verification-code': 'That code isn’t correct. Double-check it and try again.',
  'auth/code-expired': 'That code has expired. Request a new one and try again.',
  'auth/session-expired': 'Your verification session expired. Request a new code and try again.',
  'auth/captcha-check-failed': 'We couldn’t verify you’re not a robot. Please refresh and try again.',
  'auth/network-request-failed': 'A network error occurred. Check your connection and try again.',
  // Configuration-class errors — retrying won't help; the site itself needs
  // a fix (wrong/missing Firebase Web API key, or the current domain isn't
  // in the Firebase project's authorized-domains list).
  'auth/invalid-app-credential': 'Phone sign-in isn’t configured correctly right now. Please contact support.',
  'auth/app-not-authorized': 'This site isn’t authorized for phone sign-in yet. Please contact support.',
};

// Handles three sources of errors this flow can see: a Firebase JS SDK error
// (has `.code` like "auth/xxx"), our own backend's response (an axios error
// with `.response.data.message` — already written as safe, friendly text by
// server/utils/ApiError.js, so it's used as-is), and a raw network failure
// (axios `.code === 'ERR_NETWORK'`, or no response at all).
export function friendlyFirebaseAuthError(error) {
  if (!error) return 'Something went wrong. Please try again.';

  const firebaseCode = error.code || '';
  if (MESSAGES[firebaseCode]) return MESSAGES[firebaseCode];

  const backendMessage = error.response?.data?.message;
  if (backendMessage) return backendMessage;

  if (error.code === 'ERR_NETWORK' || !navigator.onLine) return MESSAGES['auth/network-request-failed'];
  if (firebaseCode.startsWith('auth/')) return 'Something went wrong. Please try again.';

  return error.message || 'Something went wrong. Please try again.';
}
