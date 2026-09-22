import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../services/orderService';
import { EmptyState } from '../components/ui/EmptyState';
import { formatINR } from '../utils/currency';

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  SHIPPED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  RETURNED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  REFUNDED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-zinc-400">Loading orders...</div>;

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="No orders yet"
          description="Your order history will show up here once you make a purchase."
          action={
            <Link to="/" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              Browse Products
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Order History</h1>

      <div className="mt-6 flex flex-col gap-3">
        {orders.map((order) => (
          <Link
            key={order._id}
            to={`/orders/${order._id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 hover:border-brand-400 dark:border-zinc-800"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{order.orderNumber}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(order.createdAt).toLocaleDateString()} · {order.orderItems.length} item(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{formatINR(order.totalPriceInPaise / 100)}</p>
              <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[order.status] || 'bg-zinc-100 text-zinc-700'}`}>
                {order.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
