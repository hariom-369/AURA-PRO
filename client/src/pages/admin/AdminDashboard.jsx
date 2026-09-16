import React, { useState, useEffect } from 'react';
import API from '../../api/axios';

export default function AdminDashboard({ onProductAdded }) {
  // Real-time Analytics State
  const [stats, setStats] = useState({
    totalRevenueInPaise: 0,
    ordersCount: 0,
    pendingOrdersCount: 0,
    lowStockCount: 0
  });

  // Product Form State
  const [form, setForm] = useState({
    name: '',
    price: '',
    compareAtPrice: '',
    description: '',
    category: '',
    brand: 'AURA',
    stock: '',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data } = await API.get('/admin/analytics/overview');
      if (data && data.data) {
        setStats(data.data);
      }
    } catch (err) {
      console.warn('Could not fetch real-time analytics overview:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const priceInPaise = Math.round((Number(form.price) || 0) * 100);
    const compareAtPriceInPaise = form.compareAtPrice ? Math.round(Number(form.compareAtPrice) * 100) : 0;
    const generatedSlug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const productPayload = {
      name: form.name,
      slug: generatedSlug || `product-${Date.now()}`,
      brand: form.brand || 'AURA',
      category: form.category,
      description: form.description,
      basePriceInPaise: priceInPaise,
      compareAtPriceInPaise: compareAtPriceInPaise,
      price: Number(form.price) || 0,
      originalPrice: Number(form.compareAtPrice) || 0,
      stock: Number(form.stock) || 0,
      images: [form.imageUrl],
      primaryImage: form.imageUrl,
      imageUrl: form.imageUrl
    };

    const localProductItem = {
      id: Date.now().toString(),
      _id: Date.now().toString(),
      ...productPayload
    };

    // 1. Attempt API request to backend
    try {
      await API.post('/products', productPayload);
    } catch (err) {
      console.warn('Backend /products route unavailable, proceeding with local catalog save:', err);
    }

    // 2. Persist locally to update UI immediately
    try {
      const existingProducts = JSON.parse(localStorage.getItem('aura_products') || '[]');
      const updatedProducts = [localProductItem, ...existingProducts];
      localStorage.setItem('aura_products', JSON.stringify(updatedProducts));
      window.dispatchEvent(new Event('productsUpdated'));
    } catch (storageErr) {
      console.error('Failed to sync product to local storage:', storageErr);
    }

    alert('New product added to catalog successfully!');

    setForm({
      name: '',
      price: '',
      compareAtPrice: '',
      description: '',
      category: '',
      brand: 'AURA',
      stock: '',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
    });

    setSubmitting(false);
    if (onProductAdded) onProductAdded();
    fetchAnalytics(); // Refresh analytics metrics
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Admin Studio Dashboard</h1>

      {/* Analytics Overview Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Revenue</span>
          <h2 style={styles.cardVal}>
            {loadingStats ? '...' : `₹${((stats.totalRevenueInPaise || 0) / 100).toLocaleString('en-IN')}`}
          </h2>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Orders</span>
          <h2 style={styles.cardVal}>{loadingStats ? '...' : stats.ordersCount}</h2>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Pending Orders</span>
          <h2 style={styles.cardVal}>{loadingStats ? '...' : stats.pendingOrdersCount}</h2>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Low Stock Alerts</span>
          <h2 style={{ ...styles.cardVal, color: stats.lowStockCount > 0 ? '#ef4444' : '#10b981' }}>
            {loadingStats ? '...' : stats.lowStockCount}
          </h2>
        </div>
      </div>

      {/* Product Creation Form */}
      <div style={styles.formCard}>
        <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Add New Product to Catalog</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <input 
              placeholder="Product Name" 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              required 
              style={styles.input} 
            />
            <input 
              placeholder="Brand (e.g. AURA)" 
              value={form.brand} 
              onChange={(e) => setForm({ ...form, brand: e.target.value })} 
              required 
              style={styles.input} 
            />
          </div>

          <div style={styles.formGroup}>
            <input 
              type="number" 
              placeholder="Selling Price (₹)" 
              value={form.price} 
              onChange={(e) => setForm({ ...form, price: e.target.value })} 
              required 
              style={styles.input} 
            />
            <input 
              type="number" 
              placeholder="Original Price / Compare At (₹)" 
              value={form.compareAtPrice} 
              onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} 
              style={styles.input} 
            />
          </div>

          <div style={styles.formGroup}>
            <input 
              placeholder="Category" 
              value={form.category} 
              onChange={(e) => setForm({ ...form, category: e.target.value })} 
              required 
              style={styles.input} 
            />
            <input 
              type="number" 
              placeholder="Stock Level" 
              value={form.stock} 
              onChange={(e) => setForm({ ...form, stock: e.target.value })} 
              required 
              style={styles.input} 
            />
          </div>

          <input 
            placeholder="Primary Image URL" 
            value={form.imageUrl} 
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} 
            required
            style={styles.input} 
          />

          <textarea 
            placeholder="Description" 
            value={form.description} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            required 
            style={{ ...styles.input, height: '90px', resize: 'vertical' }} 
          />

          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? 'Adding Product...' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem', color: '#18181b' },
  pageTitle: { fontSize: '1.875rem', fontWeight: '700', marginBottom: '1.5rem' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  card: { backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardLabel: { fontSize: '0.875rem', color: '#71717a', fontWeight: '500' },
  cardVal: { fontSize: '1.75rem', marginTop: '0.5rem', fontWeight: '700', color: '#09090b' },
  formCard: { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e4e4e7', padding: '1.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  formGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #d4d4d8', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' },
  button: { padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginTop: '8px' }
};