import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getSellerAnalytics } from '../../services/sellerService';
import { formatINR } from '../../utils/currency';

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <h2 className={`mt-1.5 text-2xl font-extrabold ${accent || 'text-zinc-900 dark:text-zinc-50'}`}>{value}</h2>
    </div>
  );
}

export default function SellerOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSellerAnalytics().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-zinc-400">Loading analytics...</p>;
  if (!stats) return <p className="text-sm text-zinc-400">Analytics unavailable.</p>;

  const trendData = (stats.revenueTrend || []).map((d) => ({
    date: d._id.slice(5),
    earnings: Math.round(d.netEarningsInPaise / 100),
  }));
  const topProductsData = (stats.topProducts || []).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    revenue: Math.round(p.revenueInPaise / 100),
  }));

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross Revenue" value={formatINR(stats.grossRevenueInPaise / 100)} />
        <StatCard label="Commission Paid" value={formatINR(stats.commissionPaidInPaise / 100)} accent="text-amber-500" />
        <StatCard label="Net Earnings" value={formatINR(stats.netEarningsInPaise / 100)} accent="text-emerald-500" />
        <StatCard label="Active Products" value={stats.activeProductCount} />
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Earnings are a bookkeeping record, not a live payout — settlement to your bank account happens off-platform.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Net Earnings (Last 30 Days)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis dataKey="date" fontSize={11} stroke="currentColor" className="text-zinc-400" />
                <YAxis fontSize={11} stroke="currentColor" className="text-zinc-400" />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line type="monotone" dataKey="earnings" stroke="#6366f1" strokeWidth={2} dot={false} />
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
    </div>
  );
}
