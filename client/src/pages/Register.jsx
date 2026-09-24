import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import TurnstileWidget from '../components/TurnstileWidget';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { isTurnstileConfigured } from '../config/authProviders';

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

const ACCOUNT_TYPES = [
  { id: 'buyer', label: 'Buyer', body: 'Shop on AURA PRO' },
  { id: 'seller', label: 'Seller', body: 'Sell on AURA PRO' },
];

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const turnstileRef = useRef(null);

  const [accountType, setAccountType] = useState('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Never a role — this is pure frontend intent that only decides where we
  // land after account creation. The backend always creates a 'customer'
  // account regardless; becoming a seller is still the existing, separate,
  // admin-reviewed onboarding/approval flow.
  const goToDestination = () => navigate(accountType === 'seller' ? '/sell/onboarding' : '/');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('You must accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, password, confirmPassword, acceptedTerms, turnstileToken });
      goToDestination();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Please try again.');
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      goToDestination();
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    name && email && password && confirmPassword && acceptedTerms && (!isTurnstileConfigured() || turnstileToken) && !loading;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="rounded bg-brand-600 px-2 py-1 text-xs font-black text-white">PRO</span>
          <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">AURA</span>
        </div>
        <h1 className="mt-5 text-xl font-bold text-zinc-900 dark:text-zinc-50">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Join AURA PRO to start shopping — or selling.</p>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAccountType(t.id)}
              aria-pressed={accountType === t.id}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                accountType === t.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <div>
            <label htmlFor="register-name" className="text-xs font-medium text-zinc-500">
              Full name
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="register-email" className="text-xs font-medium text-zinc-500">
              Email address
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="register-password" className="text-xs font-medium text-zinc-500">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pr-16 ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          <div>
            <label htmlFor="register-confirm-password" className="text-xs font-medium text-zinc-500">
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="font-semibold text-brand-600 dark:text-brand-400">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="font-semibold text-brand-600 dark:text-brand-400">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {isTurnstileConfigured() && (
            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} onError={setError} />
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : accountType === 'seller' ? 'Create Seller Account' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3 text-xs text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="mt-4">
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
