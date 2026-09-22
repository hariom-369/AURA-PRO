import { useEffect, useState } from 'react';
import { getAddresses, createAddress } from '../services/addressService';
import { EmptyState } from '../components/ui/EmptyState';

const EMPTY = { fullName: '', street: '', city: '', state: '', postalCode: '', phone: '', isDefault: false };

export default function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getAddresses()
      .then(setAddresses)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const address = await createAddress(form);
      setAddresses((prev) => [address, ...prev]);
      setForm(EMPTY);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Saved Addresses</h1>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-400">Loading...</p>
      ) : addresses.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No saved addresses" description="Add one below to speed up future checkouts." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {addresses.map((a) => (
            <div key={a._id} className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-900 dark:text-zinc-50">{a.fullName}</strong>
                {a.isDefault && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                {a.street}, {a.city}, {a.state} {a.postalCode} · {a.phone}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Add New Address</h2>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Street address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className="col-span-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <label className="col-span-full flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default address
          </label>
        </div>
        <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Address'}
        </button>
      </form>
    </div>
  );
}
