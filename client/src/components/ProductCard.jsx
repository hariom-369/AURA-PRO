import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCompare } from '../context/CompareContext';
import { PriceDisplay } from './ui/PriceDisplay';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { ids: compareIds, toggleCompare, max: compareMax } = useCompare();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!product) return null;

  const imageUrl = product.primaryImage || product.images?.[0] || FALLBACK_IMAGE;
  const outOfStock = (product.stock ?? 0) <= 0;
  const isComparing = compareIds.includes(product._id);

  const handleToggleCompare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(product._id);
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || busy) return;
    setBusy(true);
    try {
      await addToCart(product, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    } catch {
      // useCart already records the error; the button just resets.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative h-56 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          src={imageUrl}
          alt={product.name || 'Product'}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = FALLBACK_IMAGE;
          }}
        />
        {product.category && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-200">
            {product.category}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-zinc-900/85 py-1.5 text-center text-[11px] font-semibold text-white">
            Out of stock
          </span>
        )}

        <button
          onClick={handleToggleCompare}
          disabled={!isComparing && compareIds.length >= compareMax}
          title={isComparing ? 'Remove from comparison' : 'Add to comparison'}
          className={`absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isComparing ? 'bg-brand-600 text-white' : 'bg-white/90 text-zinc-700 hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200'
          }`}
        >
          {isComparing ? '✓ Comparing' : '+ Compare'}
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{product.name}</h3>
          {product.rating > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="text-amber-500">★</span>
              {product.rating.toFixed(1)}
              {product.numReviews > 0 && <span>({product.numReviews})</span>}
            </div>
          )}
          {product.description && (
            <p className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{product.description}</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} />

          <button
            onClick={handleAddToCart}
            disabled={outOfStock || busy}
            title={outOfStock ? 'Out of stock' : 'Add to Cart'}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              added ? 'bg-emerald-500' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {added ? 'Added!' : outOfStock ? 'Unavailable' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </Link>
  );
}
