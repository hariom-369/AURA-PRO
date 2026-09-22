import { useState } from 'react';
import SellerOverview from './SellerOverview';
import SellerProducts from './SellerProducts';
import SellerOrders from './SellerOrders';
import SellerTransactions from './SellerTransactions';
import SellerReviews from './SellerReviews';
import SellerSettings from './SellerSettings';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'settings', label: 'Settings' },
];

export default function SellerDashboard() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Seller Dashboard</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && <SellerOverview />}
        {tab === 'products' && <SellerProducts />}
        {tab === 'orders' && <SellerOrders />}
        {tab === 'transactions' && <SellerTransactions />}
        {tab === 'reviews' && <SellerReviews />}
        {tab === 'settings' && <SellerSettings />}
      </div>
    </div>
  );
}
