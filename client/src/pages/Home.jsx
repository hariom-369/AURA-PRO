import { useEffect, useState } from 'react';
import API from '../api/axios';
import ProductCard from '../components/ProductCard';

export default function Home({ onCartUpdated }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await API.get('/products');
        setProducts(data.data.products);
        setFilteredProducts(data.data.products);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Real-time Search and Category Filtering
  useEffect(() => {
    let result = products;
    if (activeCategory !== 'All') {
      result = result.filter((p) => p.category?.toLowerCase() === activeCategory.toLowerCase());
    }
    if (search.trim() !== '') {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFilteredProducts(result);
  }, [search, activeCategory, products]);

  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];

  return (
    <main style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <span style={styles.heroTag}>SEASON RELEASE 2026</span>
          <h2 style={styles.heroTitle}>NEXT-GEN HARDWARE & DESIGN</h2>
          <p style={styles.heroSub}>
            Discover hand-crafted tech, high-end acoustics, and limited-edition wearables.
          </p>
        </div>
      </section>

      {/* Interactive Controls Bar */}
      <section style={styles.controlBar}>
        <div style={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.pillsContainer}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={activeCategory === cat ? styles.activePill : styles.pill}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Catalog Grid */}
      <section style={styles.gridSection}>
        {loading ? (
          <div style={styles.loader}>Loading storefront catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div style={styles.emptyState}>No products match your criteria.</div>
        ) : (
          <div style={styles.grid}>
            {filteredProducts.map((product) => (
              <ProductCard key={product._id} product={product} onCartUpdated={onCartUpdated} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  hero: {
    padding: '4rem 3rem 2rem 3rem',
    textAlign: 'center',
    background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.15) 0%, rgba(9, 9, 11, 0) 70%)',
  },
  heroContent: { maxWidth: '700px', margin: '0 auto' },
  heroTag: { fontSize: '0.75rem', fontWeight: '800', letterSpacing: '2px', color: '#818cf8' },
  heroTitle: { fontSize: '2.8rem', fontWeight: '800', letterSpacing: '-1px', margin: '12px 0', color: '#fff' },
  heroSub: { fontSize: '1rem', color: '#a1a1aa', lineHeight: '1.6' },
  controlBar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '2rem 3rem 1rem 3rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  searchWrapper: { width: '100%', maxWidth: '450px' },
  searchInput: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
  },
  pillsContainer: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' },
  pill: { padding: '6px 16px', backgroundColor: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: '99px', fontSize: '0.85rem', cursor: 'pointer' },
  activePill: { padding: '6px 16px', backgroundColor: '#6366f1', border: '1px solid #6366f1', color: '#fff', borderRadius: '99px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' },
  gridSection: { maxWidth: '1200px', margin: '2rem auto', padding: '0 3rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' },
  loader: { textAlign: 'center', padding: '4rem', color: '#71717a' },
  emptyState: { textAlign: 'center', padding: '4rem', color: '#71717a', backgroundColor: '#18181b', borderRadius: '16px', border: '1px dashed #27272a' },
};