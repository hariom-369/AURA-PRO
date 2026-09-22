import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { formatINR } from '../utils/currency';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';

export default function Cart() {
  const { items, loading, subtotal, changeQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-zinc-400">Loading your cart...</div>;
  }

  if (!items || items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Your cart is empty"
          description="Explore the catalog to add items."
          action={
            <Link to="/" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              Browse Products
            </Link>
          }
        />
      </div>
    );
  }

  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    navigate('/checkout');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Your Shopping Cart</h1>

      <div className="mt-6 flex flex-col gap-3">
        {items.map((item) => {
          const p = item.product || {};
          const img = p.primaryImage || p.images?.[0] || FALLBACK_IMAGE;
          const price = item.price ?? p.price ?? 0;

          return (
            <div
              key={item._id || p._id}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center gap-4">
                <img src={img} alt={p.name} className="h-14 w-14 rounded-lg object-cover" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatINR(price)}</span>
                    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-1 dark:border-zinc-700">
                      <button
                        onClick={() => changeQuantity(p._id, -1)}
                        className="px-1.5 py-0.5 text-brand-600 dark:text-brand-400"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-zinc-900 dark:text-zinc-50">{item.quantity}</span>
                      <button
                        onClick={() => changeQuantity(p._id, 1)}
                        className="px-1.5 py-0.5 text-brand-600 dark:text-brand-400"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => removeFromCart(p._id)}
                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Subtotal</span>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">{formatINR(subtotal)}</h3>
          <p className="mt-1 text-xs text-zinc-400">Tax and shipping calculated at checkout</p>
        </div>
        <button
          onClick={handleCheckout}
          className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
