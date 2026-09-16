import React, { useState } from 'react';
import API from '../api/axios';

export default function Checkout({ cartItems, clearCart, onOrderSuccess }) {
  const [step, setStep] = useState(1);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    phone: ''
  });
  const [deliveryMethod, setDeliveryMethod] = useState('STANDARD');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);

  const calculateBreakdown = async () => {
    setLoading(true);
    try {
      const payload = {
        items: cartItems.map(i => ({ productId: i.product._id || i.product, quantity: i.quantity, variantSku: i.variantSku })),
        couponCode,
        shippingMethod
      };
      const { data } = await API.post('/checkout/calculate', payload);
      setOrderSummary(data.data);
      setStep(4); // Move to Order Summary
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to calculate total');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrderAndPay = async () => {
    setLoading(true);
    try {
      const payload = {
        items: cartItems.map(i => ({ productId: i.product._id || i.product, quantity: i.quantity, variantSku: i.variantSku })),
        shippingAddress,
        deliveryMethod,
        couponCode
      };

      // 1. Create Order Server-Side
      const { data } = await API.post('/orders/create', payload);
      const { order, clientSecret } = data.data;

      // 2. Mock payment confirmation trigger (or process clientSecret via Stripe Elements)
      setStep(6);
      clearCart();
      if (onOrderSuccess) onOrderSuccess(order);
    } catch (err) {
      alert(err.response?.data?.message || 'Order creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1.5rem', color: '#fff' }}>
      <h2>Checkout (Step {step} of 6)</h2>
      
      {step === 1 && (
        <div>
          <h3>Step 1: Review Items</h3>
          {cartItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #3f3f46' }}>
              <span>{item.product.name} (x{item.quantity})</span>
              <span>₹{((item.product.basePriceInPaise * item.quantity) / 100).toFixed(2)}</span>
            </div>
          ))}
          <button style={styles.primaryBtn} onClick={() => setStep(2)}>Continue to Shipping</button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Step 2: Shipping Address</h3>
          <input placeholder="Full Name" required value={shippingAddress.fullName} onChange={e => setShippingAddress({...shippingAddress, fullName: e.target.value})} style={styles.input} />
          <input placeholder="Address Line 1" required value={shippingAddress.addressLine1} onChange={e => setShippingAddress({...shippingAddress, addressLine1: e.target.value})} style={styles.input} />
          <input placeholder="City" required value={shippingAddress.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} style={styles.input} />
          <input placeholder="State" required value={shippingAddress.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} style={styles.input} />
          <input placeholder="Postal Code" required value={shippingAddress.postalCode} onChange={e => setShippingAddress({...shippingAddress, postalCode: e.target.value})} style={styles.input} />
          <input placeholder="Phone Number" required value={shippingAddress.phone} onChange={e => setShippingAddress({...shippingAddress, phone: e.target.value})} style={styles.input} />
          <button type="submit" style={styles.primaryBtn}>Proceed to Delivery Method</button>
        </form>
      )}

      {step === 3 && (
        <div>
          <h3>Step 3: Delivery Options</h3>
          <label style={{ display: 'block', margin: '10px 0' }}>
            <input type="radio" name="delivery" value="STANDARD" checked={deliveryMethod === 'STANDARD'} onChange={() => setDeliveryMethod('STANDARD')} /> Standard Shipping (₹99 or FREE over ₹1999)
          </label>
          <label style={{ display: 'block', margin: '10px 0' }}>
            <input type="radio" name="delivery" value="EXPRESS" checked={deliveryMethod === 'EXPRESS'} onChange={() => setDeliveryMethod('EXPRESS')} /> Express Delivery (₹250)
          </label>
          <div style={{ marginTop: '15px' }}>
            <input placeholder="Promo Coupon Code" value={couponCode} onChange={e => setCouponCode(e.target.value)} style={styles.input} />
          </div>
          <button style={styles.primaryBtn} onClick={calculateBreakdown} disabled={loading}>{loading ? 'Calculating...' : 'Calculate Total Summary'}</button>
        </div>
      )}

      {step === 4 && orderSummary && (
        <div>
          <h3>Step 4: Verified Order Summary</h3>
          <div style={{ backgroundColor: '#18181b', padding: '15px', borderRadius: '8px', margin: '15px 0' }}>
            <p>Subtotal: ₹{(orderSummary.pricing.subtotalInPaise / 100).toFixed(2)}</p>
            <p>Discount: -₹{(orderSummary.pricing.discountInPaise / 100).toFixed(2)}</p>
            <p>Shipping: ₹{(orderSummary.pricing.shippingInPaise / 100).toFixed(2)}</p>
            <p>GST (18%): ₹{(orderSummary.pricing.taxInPaise / 100).toFixed(2)}</p>
            <hr />
            <h4>Final Total: ₹{(orderSummary.pricing.grandTotalInPaise / 100).toFixed(2)}</h4>
          </div>
          <button style={styles.primaryBtn} onClick={() => setStep(5)}>Proceed to Payment</button>
        </div>
      )}

      {step === 5 && (
        <div>
          <h3>Step 5: Secure Payment</h3>
          <p>Payment Processing via Stripe (Server Verified)</p>
          <button style={styles.primaryBtn} onClick={handleCreateOrderAndPay} disabled={loading}>
            {loading ? 'Processing Order...' : 'Pay & Confirm Order'}
          </button>
        </div>
      )}

      {step === 6 && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#10b981' }}>✓ Order Placed Successfully!</h2>
          <p>Your order is being processed. Payment status will update automatically upon verification.</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #3f3f46', backgroundColor: '#18181b', color: '#fff' },
  primaryBtn: { padding: '12px 20px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', width: '100%' }
};