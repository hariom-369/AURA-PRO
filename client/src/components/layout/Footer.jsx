import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-600 px-2 py-1 text-xs font-black text-white">PRO</span>
            <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50">AURA</span>
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Premium hardware and design, powered by an AI shopping assistant.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Shop</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li><Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400">All Products</Link></li>
            <li><Link to="/wishlist" className="hover:text-brand-600 dark:hover:text-brand-400">Wishlist</Link></li>
            <li><Link to="/cart" className="hover:text-brand-600 dark:hover:text-brand-400">Cart</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li><Link to="/orders" className="hover:text-brand-600 dark:hover:text-brand-400">Order History</Link></li>
            <li><Link to="/account/addresses" className="hover:text-brand-600 dark:hover:text-brand-400">Saved Addresses</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li>Shipping &amp; Returns</li>
            <li>Ask the AI assistant (bottom right)</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        © {new Date().getFullYear()} AURA PRO. All rights reserved.
      </div>
    </footer>
  );
}
