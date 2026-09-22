import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword, resendOtp } from '../services/authService';

const RESEND_COOLDOWN = 60;
const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [session, setSession] = useState(null); // { pendingToken, devCode }
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setSession(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword({ pendingToken: session.pendingToken, code, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const result = await resendOtp({ pendingToken: session.pendingToken, purpose: 'PASSWORD_RESET' });
      setSession(result);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {done ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Password reset</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Your password has been changed. Redirecting you to sign in...
            </p>
          </div>
        ) : !session ? (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Forgot your password?</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Enter your email and we'll send you a code to reset it.
            </p>
            {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>}
            <form onSubmit={handleRequest} className="mt-5 flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <button type="submit" disabled={loading} className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {loading ? 'Sending...' : 'Send reset code'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400">← Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Check your email</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              If an account exists for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{email}</span>, a reset code has been sent.
            </p>
            {session.devCode && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Dev mode</strong> — code: <span className="font-mono font-bold">{session.devCode}</span>
              </div>
            )}
            {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>}
            <form onSubmit={handleReset} className="mt-5 flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`text-center text-2xl font-bold tracking-[0.5em] ${inputClass}`}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button onClick={() => setSession(null)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                ← Use a different email
              </button>
              <button
                onClick={handleResend}
                disabled={cooldown > 0}
                className="font-semibold text-brand-600 disabled:text-zinc-400 dark:text-brand-400 dark:disabled:text-zinc-600"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
