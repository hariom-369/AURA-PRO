import { useEffect, useState } from 'react';
import { sellerListOrders, sellerUpdateItemFulfillment } from '../../services/sellerService';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../utils/currency';

const FULFILLMENT_STATUSES = ['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    sellerListOrders({ limit: 50 }).then((data) => setOrders(data.orders || [])).finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
  useEffect(load, []);

  const handleFulfillmentChange = async (orderId, itemId, status) => {
    setUpdatingItemId(itemId);
    try {
      const updated = await sellerUpdateItemFulfillment(orderId, itemId, status);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? updated : o)));
      showToast('Fulfillment status updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update status', 'error');
    } finally {
      setUpdatingItemId(null);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Orders containing your products</h3>
      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-zinc-400">No paid orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order._id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{order.orderNumber}</p>
                <span className="text-xs text-zinc-400">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {order.orderItems.map((item) => (
                  <div key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{item.name} × {item.quantity}</p>
                      <p className="text-xs text-zinc-400">{formatINR((item.priceInPaise * item.quantity) / 100)}</p>
                    </div>
                    <select
                      value={item.fulfillmentStatus || 'PENDING'}
                      disabled={updatingItemId === item._id}
                      onChange={(e) => handleFulfillmentChange(order._id, item._id, e.target.value)}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      {FULFILLMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
