import { useEffect, useState } from 'react';
import API from '../api/axios';

export default function Cart({ onCartUpdated }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchCart = async () => {
    try {
      const { data } = await API.get('/cart');
      setCart(data.data);
    } catch (err) {
      console.error('Failed to load cart', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleRemove = async (productId) => {
    try {
      await API.delete(`/cart/${productId}`);
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove item');
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { data } = await API.post('/orders/create-checkout-session', {
        items: cart.items,
      });
      // Redirect directly to Stripe's secure hosted payment page
      window.location.href = data.data.url;
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to launch checkout session');
      setCheckoutLoading(false);
    }
  };

  if (loading) return <div style={styles.centerText}>Loading your cart...</div>;
  
  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <h3>Your cart is empty</h3>
        <p style={{ color: '#a1a1aa', marginTop: '8px', fontSize: '0.9rem' }}>
          Explore the catalog to add items.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Your Shopping Cart</h2>
      
      <div style={styles.list}>
        {cart.items.map((item) => (
          <div key={item._id || item.product?._id} style={styles.itemCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {item.product?.imageUrl && (
                <img src={item.product.imageUrl} alt={item.product.name} style={styles.thumb} />
              )}
              <div>
                <h4 style={styles.itemName}>{item.product?.name || 'Product'}</h4>
                <p style={styles.itemMeta}>
                  Qty: {item.quantity} × ${item.price}
                </p>
              </div>
            </div>

            <button onClick={() => handleRemove(item.product._id)} style={styles.removeBtn}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={styles.summaryBox}>
        <div>
          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Total Amount</span>
          <h3 style={styles.totalPrice}>${cart.totalPrice?.toFixed(2)}</h3>
        </div>
        <button
          onClick={handleCheckout}
          disabled={checkoutLoading}
          style={checkoutLoading ? styles.checkoutBtnDisabled : styles.checkoutBtn}
        >
          {checkoutLoading ? 'Redirecting to Stripe...' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '3rem 1rem', maxWidth: '800px', margin: '0 auto' },
  title: { fontSize: '1.8rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' },
  centerText: { textAlign: 'center', padding: '4rem', color: '#a1a1aa' },
  emptyContainer: { textAlign: 'center', padding: '4rem 1rem', backgroundColor: '#18181b', borderRadius: '16px', border: '1px dashed #27272a', margin: '3rem auto', maxWidth: '600px', color: '#fff' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  itemCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' },
  thumb: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' },
  itemName: { margin: 0, color: '#f4f4f5', fontSize: '1rem', fontWeight: '600' },
  itemMeta: { margin: '4px 0 0 0', color: '#a1a1aa', fontSize: '0.85rem' },
  removeBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
  summaryBox: { marginTop: '2rem', padding: '1.5rem', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalPrice: { fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: 0 },
  checkoutBtn: { backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer' },
  checkoutBtnDisabled: { backgroundColor: '#3f3f46', color: '#a1a1aa', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'not-allowed' },
};