import { useState } from 'react';
import AdminOverview from './AdminOverview';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import AdminUsers from './AdminUsers';
import AdminCoupons from './AdminCoupons';
import AdminSellers from './AdminSellers';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'sellers', label: 'Sellers' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'users', label: 'Users' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Admin Studio</h1>

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
        {tab === 'overview' && <AdminOverview />}
        {tab === 'products' && <AdminProducts />}
        {tab === 'orders' && <AdminOrders />}
        {tab === 'sellers' && <AdminSellers />}
        {tab === 'coupons' && <AdminCoupons />}
        {tab === 'users' && <AdminUsers />}
      </div>
    </div>
  );
}
