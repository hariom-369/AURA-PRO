import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist } from '../services/wishlistService';
import ProductCard from '../components/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';

export default function Wishlist() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWishlist()
      .then((w) => setProducts(w.products || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-400">Loading wishlist...</div>;

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Your wishlist is empty"
          description="Save products you love to find them here later."
          action={
            <Link to="/" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              Browse Products
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Your Wishlist</h1>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}
