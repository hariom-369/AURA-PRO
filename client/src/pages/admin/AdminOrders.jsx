import { useEffect, useState } from 'react';
import { adminListOrders, adminUpdateOrderStatus, adminApproveReturn } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../utils/currency';

const STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState(null);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    adminListOrders({ limit: 50, status: statusFilter || undefined })
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
  useEffect(load, [statusFilter]);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      const updated = await adminUpdateOrderStatus(id, { status });
      setOrders((prev) => prev.map((o) => (o._id === id ? updated : o)));
      showToast(`Order marked ${status}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update order', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleApproveReturn = async (id) => {
    setUpdating(id);
    try {
      const updated = await adminApproveReturn(id);
      setOrders((prev) => prev.map((o) => (o._id === id ? updated : o)));
      showToast('Return processed', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not process return', 'error');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Orders</h3>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-zinc-400">No orders found.</p>
        ) : (
          orders.map((order) => (
            <div key={order._id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{order.orderNumber}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {order.user?.email || order.guestEmail} · {formatINR(order.totalPriceInPaise / 100)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {order.status}
                  </span>
                  {order.status === 'RETURN_REQUESTED' ? (
                    <button
                      onClick={() => handleApproveReturn(order._id)}
                      disabled={updating === order._id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Approve Return
                    </button>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => e.target.value && handleStatusChange(order._id, e.target.value)}
                      disabled={updating === order._id}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="">Update status...</option>
                      {STATUSES.filter((s) => s !== order.status).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
