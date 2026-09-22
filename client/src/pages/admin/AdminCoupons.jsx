import { useEffect, useState } from 'react';
import { adminListCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../utils/currency';

const EMPTY_FORM = {
  code: '',
  discountType: 'PERCENTAGE',
  value: '',
  minOrderValue: '',
  maxDiscount: '',
  expiryDate: '',
  usageLimit: '',
  perUserLimit: '1',
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    adminListCoupons({ limit: 50 })
      .then((data) => setCoupons(data.coupons || []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await adminCreateCoupon({
        code: form.code,
        discountType: form.discountType,
        value: Number(form.value),
        minOrderValueInPaise: form.minOrderValue ? Math.round(Number(form.minOrderValue) * 100) : undefined,
        maxDiscountInPaise: form.maxDiscount ? Math.round(Number(form.maxDiscount) * 100) : undefined,
        expiryDate: form.expiryDate,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit) || 1,
      });
      setForm(EMPTY_FORM);
      showToast('Coupon created', 'success');
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Could not create coupon');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      const updated = await adminUpdateCoupon(coupon._id, { isActive: !coupon.isActive });
      setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? updated : c)));
    } catch {
      showToast('Could not update coupon', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await adminDeleteCoupon(id);
      setCoupons((prev) => prev.filter((c) => c._id !== id));
      showToast('Coupon deleted', 'success');
    } catch {
      showToast('Could not delete coupon', 'error');
    }
  };

  const inputClass =
    'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <div>
      <form onSubmit={handleCreate} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Create Coupon</h3>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input required placeholder="Code (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`uppercase ${inputClass}`} />
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className={inputClass}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed (₹)</option>
          </select>
          <input required type="number" placeholder={form.discountType === 'PERCENTAGE' ? 'Value (%)' : 'Value (₹)'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputClass} />
          <input type="number" placeholder="Min order value (₹)" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} className={inputClass} />
          {form.discountType === 'PERCENTAGE' && (
            <input type="number" placeholder="Max discount cap (₹)" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className={inputClass} />
          )}
          <input required type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputClass} />
          <input type="number" placeholder="Total usage limit (optional)" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className={inputClass} />
          <input type="number" placeholder="Per-user limit" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} className={inputClass} />
        </div>
        <button type="submit" disabled={creating} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Coupon'}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-zinc-400">No coupons yet.</p>
        ) : (
          coupons.map((c) => (
            <div key={c._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="font-mono font-bold text-zinc-900 dark:text-zinc-50">{c.code}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {c.discountType === 'PERCENTAGE' ? `${c.value}% off` : `${formatINR(c.value / 100)} off`}
                  {c.minOrderValueInPaise > 0 && ` · min ${formatINR(c.minOrderValueInPaise / 100)}`}
                  {' · '}expires {new Date(c.expiryDate).toLocaleDateString()}
                  {' · '}used {c.usedCount}
                  {c.usageLimit ? `/${c.usageLimit}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    c.isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {c.isActive ? 'active' : 'inactive'}
                </span>
                <button onClick={() => handleToggleActive(c)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700">
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(c._id)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
