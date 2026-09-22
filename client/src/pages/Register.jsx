import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OtpVerificationStep from '../components/OtpVerificationStep';

export default function Register() {
  const [accountType, setAccountType] = useState('customer');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', adminCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSession, setOtpSession] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (accountType === 'admin' && !form.adminCode.trim()) {
      setError('An admin invite code is required to create an administrator account.');
      return;
    }

    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, phone: form.phone };
      if (accountType === 'admin') payload.adminCode = form.adminCode;
      const result = await register(payload);
      setOtpSession(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {otpSession ? (
          <OtpVerificationStep
            email={otpSession.email}
            purpose={otpSession.purpose}
            pendingToken={otpSession.pendingToken}
            devCode={otpSession.devCode}
            onBack={() => setOtpSession(null)}
            onVerified={() => navigate('/')}
          />
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Create your account</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Join AURA PRO to track orders and save your wishlist.</p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setAccountType('customer')}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  accountType === 'customer'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => setAccountType('admin')}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  accountType === 'admin'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Administrator
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Full name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Email address"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
              <input
                type="tel"
                placeholder="Mobile number"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />

              {accountType === 'admin' && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-900 dark:bg-brand-600/10">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Admin invite code</label>
                  <input
                    type="password"
                    placeholder="Enter the code you were given"
                    required
                    value={form.adminCode}
                    onChange={(e) => setForm({ ...form, adminCode: e.target.value })}
                    className={`mt-1.5 w-full ${inputClass}`}
                  />
                  <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Administrator accounts require an invite code from your store owner. Without a valid code this will
                    create a regular customer account instead.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : accountType === 'admin' ? 'Create Administrator Account' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
