import { useEffect, useState } from 'react';
import { listSellerTransactions } from '../../services/sellerService';
import { formatINR } from '../../utils/currency';

const STATUS_CLASSES = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paid_out: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  reversed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function SellerTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSellerTransactions({ limit: 50 }).then((data) => setTransactions(data.transactions || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Transaction history</h3>
      <p className="mt-1 text-xs text-zinc-400">
        A record of what each sale earned you after commission — bookkeeping only, not a live payout. Settlement to your bank account happens off-platform.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Gross</th>
              <th className="px-4 py-2">Commission</th>
              <th className="px-4 py-2">Net</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">No transactions yet.</td></tr>
            ) : (
              transactions.map((t) => (
                <tr key={t._id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-2 text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{formatINR(t.grossAmountInPaise / 100)}</td>
                  <td className="px-4 py-2 text-amber-500">{formatINR(t.commissionAmountInPaise / 100)} ({t.commissionPercent}%)</td>
                  <td className="px-4 py-2 font-semibold">{formatINR(t.netAmountInPaise / 100)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[t.status] || STATUS_CLASSES.pending}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
