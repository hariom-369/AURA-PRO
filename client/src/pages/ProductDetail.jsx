import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProductBySlug } from '../services/productService';
import { getProductReviews, createReview } from '../services/reviewService';
import { getSimilarProducts, getBundle, getReviewSummary } from '../services/aiService';
import { toggleWishlistItem, getWishlist } from '../services/wishlistService';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCompare } from '../context/CompareContext';
import { addRecentlyViewed } from '../utils/recentlyViewed';
import { formatINR } from '../utils/currency';
import ProductCard from '../components/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { ids: compareIds, toggleCompare } = useCompare();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [inWishlist, setInWishlist] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [bundle, setBundle] = useState(null);

  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
    setLoading(true);
    setActiveImage(0);
    setQuantity(1);

    getProductBySlug(slug)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        addRecentlyViewed(p);
        getProductReviews(p._id).then((r) => !cancelled && setReviews(r.reviews || []));
        getReviewSummary(p._id).then((r) => !cancelled && setReviewSummary(r)).catch(() => {});
        getSimilarProducts(p._id).then((r) => !cancelled && setSimilar(r.products || [])).catch(() => {});
        getBundle(p._id).then((r) => !cancelled && setBundle(r)).catch(() => {});
        if (user) {
          getWishlist()
            .then((w) => !cancelled && setInWishlist((w.products || []).some((wp) => wp._id === p._id)))
            .catch(() => {});
        }
      })
      .catch(() => setProduct(null))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [slug, user]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-400">Loading product...</div>;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Product not found"
          description="This product may have been removed or the link is incorrect."
          action={
            <Link to="/" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              Back to shop
            </Link>
          }
        />
      </div>
    );
  }

  const images = product.images?.length ? product.images : [FALLBACK_IMAGE];
  const outOfStock = (product.stock ?? 0) <= 0;
  const isComparing = compareIds.includes(product._id);

  const handleAddToCart = async () => {
    try {
      await addToCart(product, quantity);
      showToast(`Added ${quantity} × ${product.name} to cart`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not add to cart', 'error');
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const w = await toggleWishlistItem(product._id);
      setInWishlist((w.products || []).some((wp) => wp._id === product._id));
    } catch {
      showToast('Could not update wishlist', 'error');
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    setSubmittingReview(true);
    try {
      const review = await createReview({ product: product._id, ...reviewForm });
      setReviews((prev) => [review, ...prev]);
      setReviewForm({ rating: 5, title: '', comment: '' });
      showToast('Review submitted', 'success');
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            <img src={images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    activeImage === i ? 'border-brand-600' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{product.category}</p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{product.name}</h1>
          {product.rating > 0 && (
            <div className="mt-2 flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="text-amber-500">★</span>
              {product.rating.toFixed(1)} ({product.numReviews} reviews)
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{formatINR(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-lg text-zinc-400 line-through">{formatINR(product.originalPrice)}</span>
            )}
            {product.discountPercentage > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {product.discountPercentage}% OFF
              </span>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{product.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.stock || 1, q + 1))} className="px-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={outOfStock}
              className="flex-1 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>

            <button
              onClick={handleToggleWishlist}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                inWishlist
                  ? 'border-rose-500 text-rose-500'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              {inWishlist ? '♥ Saved' : '♡ Save'}
            </button>

            <button
              onClick={() => toggleCompare(product._id)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                isComparing
                  ? 'border-brand-600 text-brand-600'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              {isComparing ? '✓ Comparing' : '+ Compare'}
            </button>
          </div>

          {product.specifications?.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Specifications</h2>
              <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {product.specifications.map((spec, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{spec.key}</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-50">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {bundle?.products?.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {bundle.label || 'Frequently Bought Together'}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bundle.products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Similar Products</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-16 max-w-3xl">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Customer Reviews</h2>

        {reviewSummary?.summary && (
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-600/10">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">
              AI Summary ({reviewSummary.reviewCount} reviews) — {reviewSummary.summary.overallSentiment}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">{reviewSummary.summary.summary}</p>
            {reviewSummary.summary.commonPros?.length > 0 && (
              <p className="mt-2 text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold">Pros: </span>
                {reviewSummary.summary.commonPros.join(', ')}
              </p>
            )}
            {reviewSummary.summary.commonCons?.length > 0 && (
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold">Cons: </span>
                {reviewSummary.summary.commonCons.join(', ')}
              </p>
            )}
          </div>
        )}
        {reviewSummary && !reviewSummary.summary && (
          <p className="mt-4 text-sm text-zinc-400">{reviewSummary.message}</p>
        )}

        {user && (
          <form onSubmit={handleReviewSubmit} className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Write a review</h3>
            {reviewError && <p className="mt-2 text-sm text-rose-500">{reviewError}</p>}
            <div className="mt-3 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                  className={`text-xl ${n <= reviewForm.rating ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-700'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <input
              placeholder="Title (optional)"
              value={reviewForm.title}
              onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <textarea
              placeholder="Share your experience..."
              required
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              className="mt-2 h-24 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-4">
          {reviews.length === 0 && <p className="text-sm text-zinc-400">No reviews yet — be the first to review this product.</p>}
          {reviews.map((review) => (
            <div key={review._id} className="rounded-xl border border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{review.user?.name || 'Anonymous'}</span>
                {review.isVerifiedPurchase && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Verified Purchase
                  </span>
                )}
              </div>
              <div className="mt-1 text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
              {review.title && <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{review.title}</p>}
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{review.comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
