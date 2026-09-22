import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext';
import { compareProducts } from '../services/aiService';
import { EmptyState } from '../components/ui/EmptyState';
import { formatINR } from '../utils/currency';

export default function Compare() {
  const { ids, clearCompare } = useCompare();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ids.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    compareProducts(ids)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || 'Comparison is unavailable right now.'))
      .finally(() => setLoading(false));
  }, [ids]);

  if (ids.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Select at least 2 products to compare"
          description="Use the “+ Compare” button on any product card, then come back here."
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Product Comparison</h1>
        <button onClick={clearCompare} className="text-sm font-semibold text-zinc-500 hover:text-rose-500">
          Clear all
        </button>
      </div>

      {loading && <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">Comparing products...</p>}
      {error && <p className="mt-8 text-sm text-rose-500">{error}</p>}

      {data && (
        <>
          {data.summary && (
            <p className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-zinc-700 dark:bg-brand-600/10 dark:text-zinc-200">
              {data.summary}
            </p>
          )}

          <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="p-3 text-left font-semibold text-zinc-500">Product</th>
                  {data.products.map((p) => (
                    <th key={p.id} className="p-3 text-left font-semibold text-zinc-900 dark:text-zinc-50">
                      <Link to={`/products/${p.slug}`} className="hover:text-brand-600">
                        {p.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3 font-medium text-zinc-500">Price</td>
                  {data.products.map((p) => (
                    <td key={p.id} className="p-3 text-zinc-900 dark:text-zinc-50">
                      {formatINR(p.price)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3 font-medium text-zinc-500">Rating</td>
                  {data.products.map((p) => (
                    <td key={p.id} className="p-3 text-zinc-900 dark:text-zinc-50">
                      {p.rating ? `★ ${p.rating.toFixed(1)} (${p.numReviews})` : 'No ratings yet'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3 font-medium text-zinc-500">Availability</td>
                  {data.products.map((p) => (
                    <td key={p.id} className="p-3 text-zinc-900 dark:text-zinc-50">
                      {p.inStock ? 'In stock' : 'Out of stock'}
                    </td>
                  ))}
                </tr>
                {data.rows?.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="p-3 font-medium text-zinc-500">{row.attribute}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className="p-3 text-zinc-900 dark:text-zinc-50">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.recommendation && (
            <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Our take: </span>
              {data.recommendation}
            </p>
          )}
          {!data.aiGenerated && (
            <p className="mt-4 text-xs text-zinc-400">
              AI narrative summary is unavailable right now — showing raw product data only.
            </p>
          )}
        </>
      )}
    </div>
  );
}
