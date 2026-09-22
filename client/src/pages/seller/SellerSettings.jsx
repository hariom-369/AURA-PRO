import { useEffect, useState } from 'react';
import { getSellerStore, updateSellerStore } from '../../services/sellerService';
import { useToast } from '../../context/ToastContext';

const inputClass = 'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950';

export default function SellerSettings() {
  const [store, setStore] = useState(null);
  const [form, setForm] = useState({ storeName: '', storeDescription: '', pickupAddress: {}, shippingPreferences: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    getSellerStore().then((data) => {
      setStore(data);
      setForm({
        storeName: data.store?.name || '',
        storeDescription: data.store?.description || '',
        pickupAddress: data.payout?.pickupAddress || {},
        shippingPreferences: data.payout?.shippingPreferences || {},
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateSellerStore(form);
      setStore(updated);
      showToast('Store settings updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading settings...</p>;

  return (
    <form onSubmit={handleSave} className="max-w-xl">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Store settings</h3>
      <div className="mt-3 flex flex-col gap-3">
        <label className="text-xs font-medium text-zinc-500">Store name</label>
        <input className={inputClass} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        <label className="text-xs font-medium text-zinc-500">Store description</label>
        <textarea className={`h-20 resize-none ${inputClass}`} value={form.storeDescription} onChange={(e) => setForm({ ...form, storeDescription: e.target.value })} />
        <label className="text-xs font-medium text-zinc-500">Pickup address line</label>
        <input className={inputClass} value={form.pickupAddress.line1 || ''} onChange={(e) => setForm({ ...form, pickupAddress: { ...form.pickupAddress, line1: e.target.value } })} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} placeholder="City" value={form.pickupAddress.city || ''} onChange={(e) => setForm({ ...form, pickupAddress: { ...form.pickupAddress, city: e.target.value } })} />
          <input className={inputClass} placeholder="Postal code" value={form.pickupAddress.postalCode || ''} onChange={(e) => setForm({ ...form, pickupAddress: { ...form.pickupAddress, postalCode: e.target.value } })} />
        </div>
        <label className="text-xs font-medium text-zinc-500">Preferred shipping carrier</label>
        <input className={inputClass} value={form.shippingPreferences.carrier || ''} onChange={(e) => setForm({ ...form, shippingPreferences: { ...form.shippingPreferences, carrier: e.target.value } })} />
      </div>
      <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {store?.payout && (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Payout details on file</h4>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            {store.payout.bankName || '—'} · Account ending {store.payout.accountLast4 || '····'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">To change your bank details, contact support — this is intentionally not self-editable after approval.</p>
        </div>
      )}
    </form>
  );
}
