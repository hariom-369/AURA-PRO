import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirebaseAuthClient, isFirebaseConfigured } from '../config/firebase';
import API from '../api/axios';

export { isFirebaseConfigured };

let recaptchaVerifier = null;

// ROOT CAUSE of "reCAPTCHA has already been rendered in this element":
// RecaptchaVerifier.clear() is a no-op on the DOM for an invisible verifier
// (`{ size: 'invisible' }`) — it only marks the JS wrapper object destroyed
// (see @firebase/auth's RecaptchaVerifier.clear(), which only empties the
// container's child nodes `if (!this.isInvisible)`). The actual widget
// Google's grecaptcha script injects into the container DOM node is left in
// place, and grecaptcha itself tracks "this element already has a widget"
// independently of Firebase's bookkeeping. So destroying-and-recreating a
// new RecaptchaVerifier bound to the *same* container on every send (the
// previous approach here) leaves a real widget in the DOM while asking
// grecaptcha to render a second one into it — which throws exactly that
// error. The fix is to never re-render into a container that already has a
// live widget: create the verifier once and reuse it (render() itself is
// idempotent/cached — see the SDK's `if (this.renderPromise) return
// this.renderPromise`), and only tear it down, DOM included, when the
// widget itself needs to be discarded (component unmount, or Firebase
// reporting the captcha challenge itself is no longer valid).
function clearRecaptchaContainerDom(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.replaceChildren();
}

export function resetRecaptcha(containerId) {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Already destroyed (e.g. a second call) — nothing left to clean up JS-side.
    }
    recaptchaVerifier = null;
  }
  // Belt-and-suspenders: clear() not removing DOM for an invisible verifier
  // is exactly the bug above, so this app always cleans the container itself
  // too rather than relying on Firebase to do it.
  if (containerId) clearRecaptchaContainerDom(containerId);
}

function getOrCreateRecaptchaVerifier(containerId) {
  const auth = getFirebaseAuthClient();
  if (!auth) throw new Error('Phone sign-in is not configured.');
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return recaptchaVerifier;
}

// Firebase wraps most reCAPTCHA/auth failures in a proper FirebaseError with
// a `.code`, but grecaptcha's own "already rendered" collision (see above)
// is thrown directly by Google's script with no Firebase wrapping at all —
// no `.code`, just a message. Detected here so it gets the same
// auth/captcha-check-failed treatment (a real, recoverable captcha problem)
// instead of falling through to a generic, unhelpful error.
function isUnwrappedRecaptchaRenderCollision(error) {
  return Boolean(error) && !error.code && typeof error.message === 'string' && /recaptcha/i.test(error.message) && /already/i.test(error.message);
}

function devLog(label, error) {
  // Dev-only, and only the code/message — never the phone number, ID token,
  // SMS code, or any other credential.
  if (import.meta.env.DEV) {
    console.error(`[firebaseAuthService] ${label}`, { code: error?.code, message: error?.message });
  }
}

// Step 1: send the SMS (or, in development, trigger Firebase's fixed-code
// path for a configured test number — no real SMS is sent either way from
// this app's perspective; that's entirely Firebase Console configuration).
// Returns a confirmationResult the caller must hold onto for step 2. Safe to
// call again for a resend — the verifier is reused, not recreated.
export async function sendPhoneVerificationCode(phoneNumber, containerId) {
  const auth = getFirebaseAuthClient();
  if (!auth) throw new Error('Phone sign-in is not configured.');
  const verifier = getOrCreateRecaptchaVerifier(containerId);

  try {
    return await signInWithPhoneNumber(auth, phoneNumber, verifier);
  } catch (error) {
    devLog('sendPhoneVerificationCode failed', error);
    if (error?.code === 'auth/captcha-check-failed' || isUnwrappedRecaptchaRenderCollision(error)) {
      // The rendered widget itself is now unusable — tear it down (DOM
      // included) so the next attempt renders a genuinely fresh one, and
      // normalize to a recognized code so the UI shows a specific message
      // rather than a generic fallback.
      resetRecaptcha(containerId);
      const normalized = new Error('The verification widget needs to reload. Please try again.');
      normalized.code = 'auth/captcha-check-failed';
      throw normalized;
    }
    throw error;
  }
}

// Step 2: confirm the 6-digit code, then exchange the resulting Firebase ID
// token for a normal AURA PRO session via the backend — same shape
// { user, token } every other login/verify endpoint already returns. `name`
// is optional and only ever affects a brand-new account (see
// server/services/firebasePhoneAuthService.js) — omit it for a plain login.
export async function confirmPhoneVerificationCode(confirmationResult, code, name) {
  try {
    const userCredential = await confirmationResult.confirm(code);
    const idToken = await userCredential.user.getIdToken();
    const payload = name ? { idToken, name } : { idToken };
    const { data } = await API.post('/auth/firebase/phone-login', payload);
    return data.data;
  } catch (error) {
    devLog('confirmPhoneVerificationCode failed', error);
    throw error;
  }
}

export const getFirebaseAuthStatus = () => API.get('/auth/firebase/status').then((r) => r.data.data);
