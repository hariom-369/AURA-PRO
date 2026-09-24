import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PhoneLoginStep from '../components/PhoneLoginStep';
import { isFirebaseConfigured } from '../config/firebase';
import { getSellerApplication } from '../services/sellerService';

const ROLES = [
  {
    id: 'buyer',
    title: 'Shop on AURA PRO',
    body: 'Browse products, track orders, and manage your wishlist.',
  },
  {
    id: 'seller',
    title: 'Sell on AURA PRO',
    body: 'List products, fulfill orders, and track your earnings.',
  },
];

// There is no separate "buyer" or "seller" account type on the backend —
// every account can both shop and apply to sell (see Seller.status, which is
// what actually gates seller-only pages, not User.role). `role` here is pure
// frontend intent: it only decides the copy and where we redirect after a
// successful phone verification, never anything the backend trusts.
export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();

  const [role, setRole] = useState(location.state?.role || null);
  const [mode, setMode] = useState(location.state?.mode === 'signup' ? 'signup' : 'signin');

  const goHome = () => navigate(location.state?.from?.pathname || '/');

  const goToSellerDestination = async () => {
    // Fetched directly rather than through SellerContext's refresh(): the
    // token was *just* written to localStorage by completeFirebasePhoneLogin
    // a moment ago, but AuthContext's `user` state update hasn't re-rendered
    // yet, so a `refresh` closure captured on this render would still be
    // bound to the pre-login (likely no-user) SellerContext state. A direct
    // call reads the fresh token via the axios interceptor regardless of
    // React's render timing. SellerContext itself catches up on its own
    // right after, via its existing effect on `user` changing.
    const application = await getSellerApplication().catch(() => null);
    if (application?.status === 'approved') return navigate('/seller', { replace: true });
    if (application) return navigate('/sell/status', { replace: true });
    // No application yet: a "Create seller account" signup goes straight
    // into the wizard (explicit intent to start now, same as
    // BecomeASeller.jsx's own CTA); a plain "Sign in" as a seller instead
    // lands on the status page, which clearly explains the account isn't
    // registered as a seller yet and links into onboarding from there,
    // rather than silently dropping them into a multi-step form.
    if (mode === 'signup') return navigate('/sell/onboarding', { replace: true });
    return navigate('/sell/status', { replace: true });
  };

  const handleVerified = () => {
    if (role === 'seller') return goToSellerDestination();
    return goHome();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!isFirebaseConfigured() ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Sign-in unavailable</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Phone sign-in isn't configured yet. Please contact the site administrator.
            </p>
          </div>
        ) : !role ? (
          <>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Welcome to AURA PRO</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Tell us why you're here so we can take you to the right place.</p>
            <div className="mt-6 flex flex-col gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className="rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:hover:border-brand-500 dark:hover:bg-brand-600/10"
                >
                  <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{r.body}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setMode('signin')}
                aria-pressed={mode === 'signin'}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'signin'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                aria-pressed={mode === 'signup'}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Create account
              </button>
            </div>
            <PhoneLoginStep key={`${role}-${mode}`} mode={mode} onCancel={() => setRole(null)} onVerified={handleVerified} />
          </>
        )}
      </div>
    </div>
  );
}
