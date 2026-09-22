import { useEffect, useState } from 'react';
import { listSellerReviews } from '../../services/sellerService';

export default function SellerReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSellerReviews({ limit: 50 }).then((data) => setReviews(data.reviews || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Reviews on your products</h3>
      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-zinc-400">No reviews yet.</p>
        ) : (
          reviews.map((r) => (
            <div key={r._id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{r.product?.name}</p>
                <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              {r.title && <p className="mt-1 font-medium text-zinc-700 dark:text-zinc-300">{r.title}</p>}
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{r.comment}</p>
              <p className="mt-2 text-xs text-zinc-400">
                {r.user?.name || 'Customer'} · {new Date(r.createdAt).toLocaleDateString()}
                {r.isVerifiedPurchase && <span className="ml-1.5 font-semibold text-emerald-500">· Verified purchase</span>}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
