import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendPhoneVerificationCode, confirmPhoneVerificationCode, resetRecaptcha } from '../services/firebaseAuthService';

const RECAPTCHA_CONTAINER_ID = 'firebase-phone-recaptcha';
const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

// A single flow for both new and returning users — Firebase Phone Auth (and
// the backend's findOrCreateUserFromFirebase) doesn't distinguish "register"
// from "login" for phone; verifying the number either creates a first-time
// account, claims a matching pre-existing account, or signs an existing
// Firebase-linked one back in. This is the only sign-in method in the app.
export default function PhoneLoginStep({ onVerified, onCancel }) {
  const { completeFirebasePhoneLogin } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await sendPhoneVerificationCode(phoneNumber, RECAPTCHA_CONTAINER_ID);
      setConfirmationResult(result);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Could not send verification code. Check the number and try again.');
      resetRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await confirmPhoneVerificationCode(confirmationResult, code);
      completeFirebasePhoneLogin(result);
      onVerified(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Invisible reCAPTCHA anchor Firebase requires — renders nothing visible. */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {!confirmationResult ? (
        <>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Continue with phone</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your mobile number including country code, e.g. <span className="font-mono">+1 650 555 3434</span>.
          </p>
          {error && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>
          )}
          <form onSubmit={handleSendCode} className="mt-5 flex flex-col gap-3">
            <input
              type="tel"
              required
              placeholder="+1 650 555 3434"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
          <button onClick={onCancel} className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back
          </button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Enter the code</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            We sent a 6-digit code to <span className="font-semibold text-zinc-700 dark:text-zinc-300">{phoneNumber}</span>.
          </p>
          {error && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>
          )}
          <form onSubmit={handleVerifyCode} className="mt-5 flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
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
          <button
            onClick={() => {
              setConfirmationResult(null);
              setCode('');
              setError('');
            }}
            className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Use a different number
          </button>
        </>
      )}
    </div>
  );
}
