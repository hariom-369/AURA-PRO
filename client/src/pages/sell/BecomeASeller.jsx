import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSeller } from '../../context/SellerContext';

const PERKS = [
  { title: 'Reach real customers', body: 'List your products alongside AURA PRO\'s own catalog and reach every shopper on the platform.' },
  { title: 'You stay in control', body: 'Manage your own pricing, inventory, and fulfillment from a dedicated seller dashboard.' },
  { title: 'Transparent commission', body: 'A clear, fixed commission on each sale — see exactly what you earn on every order.' },
];

export default function BecomeASeller() {
  const { user } = useAuth();
  const { application, loading } = useSeller();
  const navigate = useNavigate();

  const handleCta = () => {
    if (!user) return navigate('/login', { state: { from: { pathname: '/sell/onboarding' } } });
    if (application) return navigate('/sell/status');
    navigate('/sell/onboarding');
  };

  const ctaLabel = !user ? 'Sign in to get started' : application ? 'View your application' : 'Start your application';

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
      <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
        SELL ON AURA PRO
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
        Bring your store to AURA PRO
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
        Join our marketplace as an approved seller — list products, manage orders, and track your earnings from one dashboard.
      </p>

      <button
        onClick={handleCta}
        disabled={loading}
        className="mt-8 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {ctaLabel}
      </button>

      <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.title}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-zinc-400">
        Already an approved seller?{' '}
        <Link to="/seller" className="font-semibold text-brand-600 dark:text-brand-400">Go to your dashboard →</Link>
      </p>
    </div>
  );
}
