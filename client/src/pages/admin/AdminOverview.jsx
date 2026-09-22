import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAnalyticsOverview, getAiBusinessInsights } from '../../services/adminService';
import { formatINR } from '../../utils/currency';

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <h2 className={`mt-1.5 text-2xl font-extrabold ${accent || 'text-zinc-900 dark:text-zinc-50'}`}>{value}</h2>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  useEffect(() => {
    getAnalyticsOverview()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateInsights = () => {
    setInsightsLoading(true);
    setInsightsError('');
    getAiBusinessInsights()
      .then((data) => setInsights(data.insights))
      .catch((err) => setInsightsError(err.response?.data?.message || 'AI insights are unavailable right now'))
      .finally(() => setInsightsLoading(false));
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading analytics...</p>;
  if (!stats) return <p className="text-sm text-zinc-400">Analytics unavailable.</p>;

  const trendData = (stats.revenueTrend || []).map((d) => ({
    date: d._id.slice(5),
    revenue: Math.round(d.revenueInPaise / 100),
    orders: d.orders,
  }));

  const topProductsData = (stats.topProducts || []).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    revenue: Math.round(p.revenueInPaise / 100),
  }));

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total Revenue" value={formatINR(stats.totalRevenueInPaise / 100)} />
        <StatCard label="Total Orders" value={stats.ordersCount} />
        <StatCard label="Avg Order Value" value={formatINR(stats.avgOrderValueInPaise / 100)} />
        <StatCard label="Pending Orders" value={stats.pendingOrdersCount} accent="text-amber-500" />
        <StatCard label="Low Stock Alerts" value={stats.lowStockCount} accent={stats.lowStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'} />
        <StatCard label="Customers" value={stats.totalCustomers} />
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Note: metrics reflect actual order data at query time — estimates like "Avg Order Value" can shift quickly with low order volume.
      </p>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">✨ AI Business Insights</h3>
            <p className="text-xs text-zinc-400">AI-generated estimate from the real numbers above — not a directive.</p>
          </div>
          <button
            onClick={handleGenerateInsights}
            disabled={insightsLoading}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {insightsLoading ? 'Analyzing...' : insights ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        {insightsError && <p className="mt-3 text-sm text-rose-500">{insightsError}</p>}
        {insights && (
          <div className="mt-3 text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{insights.headline}</p>
            {insights.observations?.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
                {insights.observations.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            )}
            {insights.suggestedActions?.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Suggested (estimate only)</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
                  {insights.suggestedActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Revenue (Last 30 Days)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis dataKey="date" fontSize={11} stroke="currentColor" className="text-zinc-400" />
                <YAxis fontSize={11} stroke="currentColor" className="text-zinc-400" />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Top Products by Revenue</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis dataKey="name" fontSize={10} stroke="currentColor" className="text-zinc-400" />
                <YAxis fontSize={11} stroke="currentColor" className="text-zinc-400" />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Top Customers by Spend</h3>
        {stats.topCustomers?.length > 0 ? (
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {stats.topCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</p>
                  <p className="text-xs text-zinc-400">{c.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{formatINR(c.totalSpentInPaise / 100)}</p>
                  <p className="text-xs text-zinc-400">{c.orders} order(s)</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">No paid orders yet.</p>
        )}
      </div>
    </div>
  );
}
