import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../services/authService';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password, confirmPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
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
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Choose a new password</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">This link can only be used once.</p>
            {error && (
              <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
                {error.toLowerCase().includes('expired') && (
                  <>
                    {' '}
                    <Link to="/forgot-password" className="font-semibold underline">
                      Request a new link
                    </Link>
                  </>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <div>
                <label htmlFor="reset-password" className="text-xs font-medium text-zinc-500">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`mt-1 w-full ${inputClass}`}
                />
                <PasswordStrengthMeter password={password} />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="text-xs font-medium text-zinc-500">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`mt-1 w-full ${inputClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={!password || !confirmPassword || loading}
                className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
