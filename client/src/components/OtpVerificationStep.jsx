import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const RESEND_COOLDOWN = 60;

export default function OtpVerificationStep({ email, purpose, pendingToken: initialToken, devCode: initialDevCode, onVerified, onBack }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [pendingToken, setPendingToken] = useState(initialToken);
  const [devCode, setDevCode] = useState(initialDevCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const result = await verifyOtp({ pendingToken, code, purpose });
      onVerified(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      const result = await resendOtp(pendingToken, purpose);
      setPendingToken(result.pendingToken);
      setDevCode(result.devCode);
      setCode('');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Check your email</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        We sent a 6-digit code to <span className="font-semibold text-zinc-700 dark:text-zinc-300">{email}</span>.
      </p>

      {devCode && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <strong>Dev mode</strong> — no SMTP configured, so here's the code instead of a real email: <span className="font-mono font-bold">{devCode}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em] text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back
        </button>
        <button
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="font-semibold text-brand-600 disabled:text-zinc-400 dark:text-brand-400 dark:disabled:text-zinc-600"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending...' : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
