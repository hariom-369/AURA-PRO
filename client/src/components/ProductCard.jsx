import { useState } from 'react';
import API from '../api/axios';

export default function ProductCard({ product, onCartUpdated }) {
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddToCart = async () => {
    setLoading(true);
    try {
      await API.post('/cart', { productId: product._id, quantity: 1 });
      showToast('✨ Added to cart', 'success');
      if (onCartUpdated) onCartUpdated();
    } catch (err) {
      const msg = err.response?.status === 401 
        ? 'Please log in first' 
        : err.response?.data?.message || 'Error adding item';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
        borderColor: isHovered ? '#3f3f46' : '#27272a',
        boxShadow: isHovered ? '0 12px 30px rgba(0,0,0,0.5)' : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {toast && (
        <div style={{ ...styles.toast, backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444' }}>
          {toast.message}
        </div>
      )}

      <div style={styles.imageWrapper}>
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{
            ...styles.image,
            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
          }}
        />
        <span style={styles.categoryBadge}>{product.category}</span>
      </div>

      <div style={styles.body}>
        <h3 style={styles.title}>{product.name}</h3>
        <p style={styles.description}>{product.description}</p>

        <div style={styles.footer}>
          <div>
            <span style={styles.currency}>$</span>
            <span style={styles.price}>{product.price.toLocaleString()}</span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.stock <= 0 || loading}
            style={product.stock > 0 ? styles.button : styles.buttonDisabled}
          >
            {loading ? 'Adding...' : product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '220px',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#09090b',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  categoryBadge: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    backdropFilter: 'blur(8px)',
    color: '#d4d4d8',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '99px',
    border: '1px solid rgba(255,255,255,0.1)',
    textTransform: 'uppercase',
  },
  body: { padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 },
  title: { fontSize: '1.1rem', fontWeight: '700', color: '#f4f4f5', marginBottom: '6px' },
  description: { fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.4', flexGrow: 1, marginBottom: '16px' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #27272a' },
  currency: { fontSize: '0.9rem', color: '#6366f1', fontWeight: '700', marginRight: '2px' },
  price: { fontSize: '1.3rem', fontWeight: '800', color: '#fff' },
  button: { padding: '10px 18px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' },
  buttonDisabled: { padding: '10px 18px', backgroundColor: '#27272a', color: '#71717a', border: 'none', borderRadius: '10px', fontSize: '0.85rem', cursor: 'not-allowed' },
  toast: { position: 'absolute', top: '12px', right: '12px', zIndex: 10, color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' },
};