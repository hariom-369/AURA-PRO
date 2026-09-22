import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrderById, requestReturn } from '../services/orderService';
import { useToast } from '../context/ToastContext';
import { formatINR } from '../utils/currency';

export default function OrderDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const load = () => {
    setLoading(true);
    getOrderById(id)
      .then(setOrder)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
  useEffect(load, [id]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-zinc-400">Loading order...</div>;
  if (!order) return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-zinc-400">Order not found.</div>;

  const handleRequestReturn = async (e) => {
    e.preventDefault();
    setSubmittingReturn(true);
    try {
      const updated = await requestReturn(id, returnReason);
      setOrder(updated);
      showToast('Return requested', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not request return', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/orders" className="text-sm font-semibold text-brand-600 dark:text-brand-400">
        ← Back to Orders
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{order.orderNumber}</h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {order.status}
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Items</h2>
        <div className="mt-3 space-y-2">
          {order.orderItems.map((item) => (
            <div key={item._id} className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatINR((item.priceInPaise * item.quantity) / 100)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-zinc-100 pt-3 text-base font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <span>Total</span>
          <span>{formatINR(order.totalPriceInPaise / 100)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Shipping To</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {order.shippingAddress.fullName}
          <br />
          {order.shippingAddress.address}, {order.shippingAddress.city}, {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </p>
        {order.trackingNumber && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Tracking: <strong>{order.trackingNumber}</strong>
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Order Timeline</h2>
        <div className="mt-3 space-y-3">
          {order.timeline.map((event, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{event.status}</p>
                <p className="text-xs text-zinc-400">{new Date(event.timestamp).toLocaleString()}</p>
                {event.note && <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">{event.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {order.status === 'DELIVERED' && (
        <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Request a Return</h2>
          <p className="mt-1 text-xs text-zinc-400">Returns are accepted within 7 days of delivery.</p>
          <form onSubmit={handleRequestReturn} className="mt-3 flex gap-2">
            <input
              required
              placeholder="Reason for return"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button type="submit" disabled={submittingReturn} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {submittingReturn ? 'Submitting...' : 'Request Return'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
