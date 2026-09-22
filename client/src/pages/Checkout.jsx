import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getAddresses, createAddress } from '../services/addressService';
import { previewOrder, createOrder, payForOrder } from '../services/orderService';
import { formatINR } from '../utils/currency';

const EMPTY_ADDRESS = { fullName: '', street: '', city: '', state: '', postalCode: '', phone: '', isDefault: true };

export default function Checkout() {
  const { items, subtotal, refreshCart } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [addingAddress, setAddingAddress] = useState(false);

  const [shippingMethod, setShippingMethod] = useState('STANDARD');
  const [couponCode, setCouponCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAddresses()
      .then((list) => {
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) setSelectedAddressId(def._id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
    setPreviewLoading(true);
    previewOrder({ shippingMethod, couponCode: couponCode || undefined })
      .then(setPreview)
      .catch((err) => setError(err.response?.data?.message || 'Could not calculate order total'))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethod, items.length]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your cart is empty</h2>
        <button onClick={() => navigate('/')} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
          Browse Products
        </button>
      </div>
    );
  }

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setAddingAddress(true);
    setError('');
    try {
      const address = await createAddress(newAddress);
      setAddresses((prev) => [address, ...prev]);
      setSelectedAddressId(address._id);
      setNewAddress(EMPTY_ADDRESS);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save address');
    } finally {
      setAddingAddress(false);
    }
  };

  const handleApplyCoupon = () => {
    setPreviewLoading(true);
    previewOrder({ shippingMethod, couponCode: couponCode || undefined })
      .then(setPreview)
      .catch((err) => setError(err.response?.data?.message || 'Invalid coupon code'))
      .finally(() => setPreviewLoading(false));
  };

  const handlePlaceOrder = async () => {
    const address = addresses.find((a) => a._id === selectedAddressId);
    if (!address) {
      setError('Please select or add a shipping address');
      return;
    }

    setPlacing(true);
    setError('');
    try {
      const order = await createOrder({
        shippingAddress: {
          fullName: address.fullName,
          address: address.street,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        },
        shippingMethod,
        couponCode: couponCode || undefined,
      });

      await refreshCart();

      const { url } = await payForOrder(order._id);
      window.location.href = url;
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed — please try again');
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Checkout</h1>

      {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>}

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">1. Shipping Address</h2>

        {addresses.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {addresses.map((a) => (
              <label
                key={a._id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                  selectedAddressId === a._id ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/10' : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <input type="radio" checked={selectedAddressId === a._id} onChange={() => setSelectedAddressId(a._id)} className="mt-1" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  <strong className="text-zinc-900 dark:text-zinc-50">{a.fullName}</strong> — {a.street}, {a.city}, {a.state} {a.postalCode} · {a.phone}
                </span>
              </label>
            ))}
          </div>
        )}

        <form onSubmit={handleAddAddress} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input required placeholder="Full name" value={newAddress.fullName} onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Phone" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Street address" value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} className="col-span-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input required placeholder="Postal code" value={newAddress.postalCode} onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <button type="submit" disabled={addingAddress} className="rounded-lg border border-zinc-300 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {addingAddress ? 'Saving...' : '+ Save New Address'}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">2. Delivery Method</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={shippingMethod === 'STANDARD'} onChange={() => setShippingMethod('STANDARD')} />
            Standard — ₹99 (free over ₹1999)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={shippingMethod === 'EXPRESS'} onChange={() => setShippingMethod('EXPRESS')} />
            Express — ₹250
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            placeholder="Coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button onClick={handleApplyCoupon} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700">
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">3. Order Summary</h2>
        {previewLoading ? (
          <p className="mt-3 text-sm text-zinc-400">Calculating...</p>
        ) : preview ? (
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
              <span>Subtotal</span>
              <span>{formatINR(preview.pricing.subtotalInPaise / 100)}</span>
            </div>
            {preview.pricing.discountInPaise > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>−{formatINR(preview.pricing.discountInPaise / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
              <span>Shipping</span>
              <span>{formatINR(preview.pricing.shippingInPaise / 100)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
              <span>GST (18%)</span>
              <span>{formatINR(preview.pricing.taxInPaise / 100)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-base font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
              <span>Total</span>
              <span>{formatINR(preview.pricing.grandTotalInPaise / 100)}</span>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">Subtotal: {formatINR(subtotal)}</p>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={placing || !selectedAddressId}
          className="mt-5 w-full rounded-lg bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? 'Redirecting to secure payment...' : 'Place Order & Pay'}
        </button>
      </div>
    </div>
  );
}
