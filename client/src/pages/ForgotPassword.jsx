import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/authService';
import TurnstileWidget from '../components/TurnstileWidget';
import { isTurnstileConfigured } from '../config/authProviders';

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export default function ForgotPassword() {
  const turnstileRef = useRef(null);
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await forgotPassword({ email, turnstileToken });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email && (!isTurnstileConfigured() || turnstileToken) && !loading;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {done ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Check your email</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              If an account exists for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{email}</span>, a
              password reset link has been sent. The link expires in 30 minutes.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 dark:text-brand-400">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Forgot your password?</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
            {error && (
              <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <label htmlFor="forgot-email" className="sr-only">
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              {isTurnstileConfigured() && (
                <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} onError={setError} />
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400">
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
