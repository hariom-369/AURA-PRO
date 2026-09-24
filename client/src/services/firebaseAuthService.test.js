import { describe, it, expect, vi, beforeEach } from 'vitest';

// A real `function` (not an arrow function) so `new RecaptchaVerifier(...)`
// in the module under test works — arrow functions can't be constructors.
const RecaptchaVerifierMock = vi.fn(function RecaptchaVerifierCtor() {
  this.clear = vi.fn();
});
const signInWithPhoneNumberMock = vi.fn();

vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: RecaptchaVerifierMock,
  signInWithPhoneNumber: (...args) => signInWithPhoneNumberMock(...args),
}));

const getFirebaseAuthClientMock = vi.fn();
vi.mock('../config/firebase', () => ({
  getFirebaseAuthClient: () => getFirebaseAuthClientMock(),
  isFirebaseConfigured: () => true,
}));

vi.mock('../api/axios', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

const CONTAINER_ID = 'firebase-phone-recaptcha';

describe('firebaseAuthService — reCAPTCHA lifecycle', () => {
  let sendPhoneVerificationCode;
  let resetRecaptcha;

  beforeEach(async () => {
    vi.resetModules();
    RecaptchaVerifierMock.mockClear();
    signInWithPhoneNumberMock.mockReset();
    getFirebaseAuthClientMock.mockReset().mockReturnValue({});
    document.body.innerHTML = `<div id="${CONTAINER_ID}"></div>`;

    const mod = await import('./firebaseAuthService');
    sendPhoneVerificationCode = mod.sendPhoneVerificationCode;
    resetRecaptcha = mod.resetRecaptcha;
  });

  it('creates the reCAPTCHA verifier once and reuses it on a second send (resend), never re-rendering into the same container', async () => {
    signInWithPhoneNumberMock.mockResolvedValue({ confirm: vi.fn() });

    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);
    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);

    // This is the actual fix: the previous implementation recreated a new
    // RecaptchaVerifier (and therefore re-rendered) on every call, which is
    // what produced "reCAPTCHA has already been rendered in this element"
    // for an invisible verifier (whose clear() doesn't touch the DOM).
    expect(RecaptchaVerifierMock).toHaveBeenCalledTimes(1);
    expect(signInWithPhoneNumberMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes an unwrapped grecaptcha "already rendered" collision to a recognized auth/captcha-check-failed error, and tears the widget down so the next attempt gets a fresh one', async () => {
    // Simulates the raw error grecaptcha's own script throws — no Firebase
    // `.code`, just a message — which is exactly what a stale/duplicate
    // render collision looks like at this boundary.
    signInWithPhoneNumberMock.mockRejectedValueOnce(new Error('reCAPTCHA has already been rendered in this element'));

    await expect(sendPhoneVerificationCode('+919876543210', CONTAINER_ID)).rejects.toMatchObject({
      code: 'auth/captcha-check-failed',
    });

    // Torn down: the next send must create a brand-new verifier rather than
    // reusing the (now invalid) one.
    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: vi.fn() });
    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);
    expect(RecaptchaVerifierMock).toHaveBeenCalledTimes(2);
  });

  it('does not treat an ordinary Firebase error as a captcha collision, and does not tear down the verifier for it', async () => {
    const firebaseError = Object.assign(new Error('Firebase: Error (auth/invalid-phone-number).'), { code: 'auth/invalid-phone-number' });
    signInWithPhoneNumberMock.mockRejectedValueOnce(firebaseError);

    await expect(sendPhoneVerificationCode('bad-number', CONTAINER_ID)).rejects.toMatchObject({ code: 'auth/invalid-phone-number' });

    signInWithPhoneNumberMock.mockResolvedValueOnce({ confirm: vi.fn() });
    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);
    // Still just the one verifier — an ordinary error (e.g. a bad number)
    // doesn't invalidate an already-rendered, otherwise-healthy widget.
    expect(RecaptchaVerifierMock).toHaveBeenCalledTimes(1);
  });

  it('resetRecaptcha clears the container DOM (working around clear() being a no-op on the DOM for an invisible verifier)', async () => {
    signInWithPhoneNumberMock.mockResolvedValue({ confirm: vi.fn() });
    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);

    const container = document.getElementById(CONTAINER_ID);
    container.appendChild(document.createElement('iframe')); // simulates grecaptcha's injected widget

    resetRecaptcha(CONTAINER_ID);

    expect(container.childNodes.length).toBe(0);

    // And the next send creates a fresh verifier rather than reusing the cleared one.
    await sendPhoneVerificationCode('+919876543210', CONTAINER_ID);
    expect(RecaptchaVerifierMock).toHaveBeenCalledTimes(2);
  });

  it('throws a clear configuration error, without ever constructing a verifier, when Firebase is not configured', async () => {
    getFirebaseAuthClientMock.mockReturnValue(null);

    await expect(sendPhoneVerificationCode('+919876543210', CONTAINER_ID)).rejects.toThrow('Phone sign-in is not configured.');
    expect(RecaptchaVerifierMock).not.toHaveBeenCalled();
  });
});
