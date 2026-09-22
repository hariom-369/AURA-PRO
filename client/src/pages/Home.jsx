import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getProducts } from '../services/productService';
import { semanticSearch, getRecommendations } from '../services/aiService';
import { getRecentlyViewed } from '../utils/recentlyViewed';
import { useCart } from '../context/CartContext';

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export default function Home() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categories, setCategories] = useState(['All']);

  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [recommended, setRecommended] = useState([]);
  const recentlyViewed = useMemo(() => getRecentlyViewed(), []);
  const { items: cartItems } = useCart();

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    try {
      const data = await getProducts({
        page,
        limit: 24,
        search: search || undefined,
        category: activeCategory !== 'All' ? activeCategory : undefined,
        sort: sort || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      });
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, pages: 1 });
      if (categories.length === 1) {
        const uniqueCategories = ['All', ...new Set((data.products || []).map((p) => p.category).filter(Boolean))];
        setCategories(uniqueCategories);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
    fetchProducts(1);
    setAiResults(null);
    setAiError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, sort, minPrice, maxPrice]);

  useEffect(() => {
    getRecommendations({
      recentlyViewedIds: recentlyViewed.map((p) => p._id),
      cartProductIds: cartItems.map((i) => i.product?._id).filter(Boolean),
      limit: 8,
    })
      .then((res) => setRecommended(res.products || []))
      .catch(() => setRecommended([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAskAI = async () => {
    if (!search.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await semanticSearch(search.trim());
      setAiResults(result.products || []);
    } catch (err) {
      setAiResults(null);
      setAiError(err.response?.data?.message || 'AI search is unavailable right now — showing regular results.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchProducts(1);
    }
  };

  const displayedProducts = aiResults !== null ? aiResults : products;

  return (
    <main className="pb-16">
      <section className="bg-gradient-to-b from-brand-500/10 to-transparent px-4 py-16 text-center sm:px-6">
        <span className="text-xs font-extrabold tracking-widest text-brand-500">SEASON RELEASE 2026</span>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Next-gen hardware &amp; design
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
          Discover hand-crafted tech, high-end acoustics, and limited-edition wearables — with an AI assistant to help you choose.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder='Try "comfortable shoes for daily use under ₹2000"'
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={handleAskAI}
              disabled={aiLoading || !search.trim()}
              className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {aiLoading ? '...' : '✨ Ask AI'}
            </button>
          </div>
          {aiError && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{aiError}</p>}
          {aiResults !== null && !aiError && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Showing AI-interpreted results for "{search}".{' '}
              <button onClick={() => setAiResults(null)} className="font-semibold text-brand-600 underline dark:text-brand-400">
                Clear
              </button>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  activeCategory === cat
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <input
            type="number"
            placeholder="Min ₹"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-28 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            type="number"
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-28 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <EmptyState title="No products match your criteria" description="Try adjusting your filters or search terms." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayedProducts.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              {aiResults === null && pagination.pages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  {Array.from({ length: pagination.pages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => fetchProducts(i + 1)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                        pagination.page === i + 1
                          ? 'bg-brand-600 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {recommended.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Recommended for You</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommended.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      {recentlyViewed.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Recently Viewed</h2>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {recentlyViewed.map((product) => (
              <div key={product._id} className="w-48 shrink-0">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
