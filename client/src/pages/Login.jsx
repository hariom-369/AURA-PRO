import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OtpVerificationStep from '../components/OtpVerificationStep';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSession, setOtpSession] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login({ identifier, password });
      setOtpSession(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {otpSession ? (
          <OtpVerificationStep
            email={otpSession.email || identifier}
            purpose={otpSession.purpose}
            pendingToken={otpSession.pendingToken}
            devCode={otpSession.devCode}
            onBack={() => setOtpSession(null)}
            onVerified={() => navigate(location.state?.from?.pathname || '/')}
          />
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Welcome back</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Sign in to your AURA PRO account.</p>

            {error && (
              <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Email or mobile number"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <Link to="/forgot-password" className="text-center text-xs font-semibold text-brand-600 dark:text-brand-400">
                Forgot your password?
              </Link>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              New to AURA PRO?{' '}
              <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400">
                Create an account
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
