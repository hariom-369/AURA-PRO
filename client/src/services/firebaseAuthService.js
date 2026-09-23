import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirebaseAuthClient, isFirebaseConfigured } from '../config/firebase';
import API from '../api/axios';

export { isFirebaseConfigured };

let recaptchaVerifier = null;

// An invisible reCAPTCHA bound to a real DOM node — Firebase requires this
// even for phone sign-in with test numbers. Created once and reused; if the
// container element gets torn down (e.g. navigating away mid-flow) the
// caller should call resetRecaptcha() before requesting a new one.
function getRecaptchaVerifier(containerId) {
  const auth = getFirebaseAuthClient();
  if (!auth) throw new Error('Phone sign-in is not configured.');
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return recaptchaVerifier;
}

export function resetRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

// Step 1: send the SMS (or, in development, trigger Firebase's fixed-code
// path for a configured test number — no real SMS is sent either way from
// this app's perspective; that's entirely Firebase Console configuration).
// Returns a confirmationResult the caller must hold onto for step 2.
export async function sendPhoneVerificationCode(phoneNumber, containerId) {
  const auth = getFirebaseAuthClient();
  if (!auth) throw new Error('Phone sign-in is not configured.');
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

// Step 2: confirm the 6-digit code, then exchange the resulting Firebase ID
// token for a normal AURA PRO session via the backend — same shape
// { user, token } every other login/verify endpoint already returns.
export async function confirmPhoneVerificationCode(confirmationResult, code) {
  const userCredential = await confirmationResult.confirm(code);
  const idToken = await userCredential.user.getIdToken();
  const { data } = await API.post('/auth/firebase/phone-login', { idToken });
  return data.data;
}

export const getFirebaseAuthStatus = () => API.get('/auth/firebase/status').then((r) => r.data.data);
