import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendPhoneVerificationCode, confirmPhoneVerificationCode, resetRecaptcha } from '../services/firebaseAuthService';
import { COUNTRY_CODES, DEFAULT_COUNTRY } from '../constants/countryCodes';
import { normalizePhoneNumber, isValidNationalNumber, maskPhoneForDisplay } from '../utils/phone';
import { friendlyFirebaseAuthError } from '../utils/firebaseAuthErrors';

const RECAPTCHA_CONTAINER_ID = 'firebase-phone-recaptcha';
const RESEND_COOLDOWN_SECONDS = 60;

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const labelClass = 'text-xs font-medium text-zinc-500';

// A single flow for both new and returning users — Firebase Phone Auth (and
// the backend's findOrCreateUserFromFirebase) doesn't distinguish "register"
// from "login" for phone; verifying the number either creates a first-time
// account, claims a matching pre-existing account, or signs an existing
// Firebase-linked one back in. This is the only sign-in method in the app.
// `mode` only changes copy and whether a name is collected (used solely for
// naming a brand-new account) — the underlying verification call is
// identical either way.
export default function PhoneLoginStep({ mode = 'signin', onVerified, onCancel }) {
  const { completeFirebasePhoneLogin } = useAuth();
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // The reCAPTCHA widget is bound to this component instance's DOM node
      // — if it unmounts mid-flow (navigating away, switching account type)
      // a leftover verifier (and its still-rendered widget) would be left
      // behind. Clearing it here, DOM included, means the next mount always
      // starts clean. Note this is the *only* place the verifier is torn
      // down during ordinary use — see firebaseAuthService.js for why it's
      // otherwise reused (not recreated) across sends/resends.
      resetRecaptcha(RECAPTCHA_CONTAINER_ID);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const safeSetState = (setter) => (value) => {
    if (mountedRef.current) setter(value);
  };
  const setLoadingSafe = safeSetState(setLoading);
  const setResendingSafe = safeSetState(setResending);
  const setErrorSafe = safeSetState(setError);
  const setConfirmationResultSafe = safeSetState(setConfirmationResult);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setErrorSafe('');

    if (!isValidNationalNumber(nationalNumber)) {
      setErrorSafe('Enter a valid phone number.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setErrorSafe('Enter your full name.');
      return;
    }

    setLoadingSafe(true);
    try {
      const fullNumber = normalizePhoneNumber(country.dialCode, nationalNumber);
      const result = await sendPhoneVerificationCode(fullNumber, RECAPTCHA_CONTAINER_ID);
      // Only reached — and only now do we show "we sent a code" — once
      // Firebase itself has confirmed the verification request succeeded.
      setConfirmationResultSafe(result);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setErrorSafe(friendlyFirebaseAuthError(err));
    } finally {
      setLoadingSafe(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setErrorSafe('');
    setResendingSafe(true);
    try {
      const fullNumber = normalizePhoneNumber(country.dialCode, nationalNumber);
      const result = await sendPhoneVerificationCode(fullNumber, RECAPTCHA_CONTAINER_ID);
      setConfirmationResultSafe(result);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setErrorSafe(friendlyFirebaseAuthError(err));
    } finally {
      setResendingSafe(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setErrorSafe('');
    setLoadingSafe(true);
    try {
      const result = await confirmPhoneVerificationCode(confirmationResult, code, mode === 'signup' ? name.trim() : undefined);
      completeFirebasePhoneLogin(result);
      if (mountedRef.current) onVerified(result);
    } catch (err) {
      setErrorSafe(friendlyFirebaseAuthError(err));
    } finally {
      setLoadingSafe(false);
    }
  };

  const handleUseDifferentNumber = () => {
    // Deliberately does NOT reset the reCAPTCHA verifier: the already-solved
    // invisible challenge isn't tied to a specific phone number, and
    // destroying+recreating it here is exactly what previously caused
    // "reCAPTCHA has already been rendered in this element" on the next
    // send (see firebaseAuthService.js). The same verifier is reused for
    // whatever number the user enters next.
    setConfirmationResultSafe(null);
    setCode('');
    setErrorSafe('');
    setCooldown(0);
  };

  return (
    <div>
      {/* Invisible reCAPTCHA anchor Firebase requires — renders nothing visible. */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {!confirmationResult ? (
        <>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {mode === 'signup' ? 'Create your account' : 'Sign in with your phone'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'signup'
              ? 'We’ll text you a code to verify your number.'
              : 'Enter your mobile number and we’ll text you a verification code.'}
          </p>
          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          )}
          {/* Deliberately no `required` attributes here: native constraint
              validation silently blocks the submit event entirely (no error
              shown anywhere, no way to make it accessible/consistent), so
              validation and its accessible role="alert" message are handled
              entirely in handleSendCode instead. */}
          <form onSubmit={handleSendCode} className="mt-5 flex flex-col gap-3">
            {mode === 'signup' && (
              <div>
                <label htmlFor="phone-login-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="phone-login-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 w-full ${inputClass}`}
                />
              </div>
            )}
            <div>
              <label htmlFor="phone-login-number" className={labelClass}>
                Mobile number
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  aria-label="Country calling code"
                  value={country.iso}
                  onChange={(e) => setCountry(COUNTRY_CODES.find((c) => c.iso === e.target.value) || DEFAULT_COUNTRY)}
                  className={`${inputClass} w-28 shrink-0`}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.iso} {c.dialCode}
                    </option>
                  ))}
                </select>
                <input
                  id="phone-login-number"
                  type="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={nationalNumber}
                  onChange={(e) => setNationalNumber(e.target.value)}
                  className={`flex-1 ${inputClass}`}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>
          <button onClick={onCancel} className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Change account type
          </button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Enter the code</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{maskPhoneForDisplay(country.dialCode, nationalNumber)}</span>.
          </p>
          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          )}
          <form onSubmit={handleVerifyCode} className="mt-5 flex flex-col gap-3">
            <label htmlFor="phone-login-code" className="sr-only">
              Verification code
            </label>
            <input
              id="phone-login-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em] text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100`}
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button onClick={handleUseDifferentNumber} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              ← Use a different number
            </button>
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="font-semibold text-brand-600 disabled:text-zinc-400 dark:text-brand-400 dark:disabled:text-zinc-600"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
