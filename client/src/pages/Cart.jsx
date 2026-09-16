import { useEffect, useState } from 'react';
import API from '../api/axios';

export default function Cart({ onCartUpdated }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchCart = async () => {
    try {
      const { data } = await API.get('/cart');
      const apiCart = data?.data || data?.cart;

      if (apiCart && apiCart.items && apiCart.items.length > 0) {
        setCart(apiCart);
      } else {
        loadFromLocalStorage();
      }
    } catch (err) {
      console.warn('API cart load skipped/failed, falling back to local storage:', err);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const localItems = JSON.parse(
        localStorage.getItem('aura_cart') || localStorage.getItem('cart') || '[]'
      );
      
      const normalizedItems = localItems.map((item) => ({
        _id: item._id || item.id,
        product: {
          _id: item._id || item.id,
          name: item.name,
          imageUrl:
            item.primaryImage ||
            item.image ||
            (item.images && item.images[0]) ||
            'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop',
          price: item.price,
        },
        quantity: item.quantity || 1,
        price: item.price,
      }));

      const totalPrice = normalizedItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * item.quantity,
        0
      );

      setCart({ items: normalizedItems, totalPrice });
    } catch (e) {
      console.error('Failed to parse local cart:', e);
      setCart({ items: [], totalPrice: 0 });
    }
  };

  useEffect(() => {
    fetchCart();
    window.addEventListener('cartUpdated', fetchCart);
    window.addEventListener('storage', fetchCart);
    return () => {
      window.removeEventListener('cartUpdated', fetchCart);
      window.removeEventListener('storage', fetchCart);
    };
  }, []);

  const handleQuantityChange = async (productId, delta) => {
    // 1. Update LocalStorage items
    try {
      const localItems = JSON.parse(
        localStorage.getItem('aura_cart') || localStorage.getItem('cart') || '[]'
      );
      const updatedLocal = localItems
        .map((item) => {
          const id = item._id || item.id;
          if (id === productId) {
            const newQty = (item.quantity || 1) + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);

      localStorage.setItem('aura_cart', JSON.stringify(updatedLocal));
      localStorage.setItem('cart', JSON.stringify(updatedLocal));
    } catch (e) {
      console.error('Error updating local storage quantity:', e);
    }

    // 2. Update component local state directly for instantaneous UI response
    setCart((prevCart) => {
      if (!prevCart || !prevCart.items) return prevCart;
      const newItems = prevCart.items
        .map((item) => {
          const prodId = item.product?._id || item.product?.id || item._id || item.id;
          if (prodId === productId) {
            const newQty = (item.quantity || 1) + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean);

      const newTotal = newItems.reduce(
        (sum, i) => sum + Number(i.price || i.product?.price || 0) * (i.quantity || 1),
        0
      );

      return { ...prevCart, items: newItems, totalPrice: newTotal };
    });

    // 3. Optional backend synchronization
    try {
      await API.post('/cart', { productId, quantity: delta });
    } catch (err) {
      // Non-fatal if server handles cart purely client-side
    }

    window.dispatchEvent(new Event('cartUpdated'));
    if (onCartUpdated) onCartUpdated();
  };

  const handleRemove = async (productId) => {
    try {
      const localItems = JSON.parse(
        localStorage.getItem('aura_cart') || localStorage.getItem('cart') || '[]'
      );
      const updatedLocal = localItems.filter(
        (item) => (item._id || item.id) !== productId
      );
      localStorage.setItem('aura_cart', JSON.stringify(updatedLocal));
      localStorage.setItem('cart', JSON.stringify(updatedLocal));
    } catch (e) {
      console.error('Error updating local storage:', e);
    }

    try {
      await API.delete(`/cart/${productId}`);
    } catch (err) {
      console.warn('Backend item delete non-fatal error:', err);
    }

    await fetchCart();
    window.dispatchEvent(new Event('cartUpdated'));
    if (onCartUpdated) onCartUpdated();
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { data } = await API.post('/orders/create-checkout-session', {
        items: cart.items,
      });

      const redirectUrl = data?.data?.url || data?.url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        alert('Checkout URL received was invalid.');
        setCheckoutLoading(false);
      }
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

  const calculatedTotal =
    cart.totalPrice ??
    cart.items.reduce(
      (sum, item) => sum + Number(item.price || item.product?.price || 0) * (item.quantity || 1),
      0
    );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Your Shopping Cart</h2>

      <div style={styles.list}>
        {cart.items.map((item) => {
          const prodId = item.product?._id || item.product?.id || item._id || item.id;
          const name = item.product?.name || item.name || 'Product';
          const img =
            item.product?.imageUrl ||
            item.product?.image ||
            item.imageUrl ||
            item.image ||
            'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';
          const price = item.price || item.product?.price || 0;
          const qty = item.quantity || 1;

          return (
            <div key={item._id || prodId} style={styles.itemCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={img} alt={name} style={styles.thumb} />
                <div>
                  <h4 style={styles.itemName}>{name}</h4>
                  
                  {/* Item Price and Quantity Adjuster Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <span style={styles.itemMeta}>${price}</span>
                    
                    <div style={styles.qtyBox}>
                      <button
                        onClick={() => handleQuantityChange(prodId, -1)}
                        style={styles.qtyBtn}
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <span style={styles.qtyText}>{qty}</span>
                      <button
                        onClick={() => handleQuantityChange(prodId, 1)}
                        style={styles.qtyBtn}
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={() => handleRemove(prodId)} style={styles.removeBtn}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div style={styles.summaryBox}>
        <div>
          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Total Amount</span>
          <h3 style={styles.totalPrice}>${Number(calculatedTotal).toFixed(2)}</h3>
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
  thumb: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#27272a' },
  itemName: { margin: 0, color: '#f4f4f5', fontSize: '1rem', fontWeight: '600' },
  itemMeta: { margin: 0, color: '#a1a1aa', fontSize: '0.85rem' },
  qtyBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#27272a',
    borderRadius: '6px',
    padding: '2px 8px',
    border: '1px solid #3f3f46',
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  qtyText: {
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: '700',
    minWidth: '16px',
    textAlign: 'center',
  },
  removeBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
  summaryBox: { marginTop: '2rem', padding: '1.5rem', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalPrice: { fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: 0 },
  checkoutBtn: { backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer' },
  checkoutBtnDisabled: { backgroundColor: '#3f3f46', color: '#a1a1aa', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'not-allowed' },
};