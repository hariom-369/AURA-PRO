import { useState } from 'react';
import API from '../api/axios';

export default function AdminDashboard({ onProductAdded }) {
  const [form, setForm] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    stock: '',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/products', {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock)
      });
      alert('New product added to catalog!');
      setForm({
        name: '',
        price: '',
        description: '',
        category: '',
        stock: '',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
      });
      if (onProductAdded) onProductAdded();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create product');
    }
  };

  return (
    <div style={styles.card}>
      <h3>Admin Panel: Add Product</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input placeholder="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={styles.input} />
        <input type="number" placeholder="Price ($)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required style={styles.input} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required style={styles.input} />
        <input type="number" placeholder="Stock Level" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required style={styles.input} />
        <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} style={styles.input} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required style={{ ...styles.input, height: '80px' }} />
        <button type="submit" style={styles.button}>Add Product</button>
      </form>
    </div>
  );
}

const styles = {
  card: { maxWidth: '500px', margin: '2rem auto', padding: '2rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.95rem' },
  button: { padding: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};