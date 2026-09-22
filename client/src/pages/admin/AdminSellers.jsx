import { useEffect, useState } from 'react';
import { adminListSellers, adminGetSellerDocumentUrl, adminUpdateSellerStatus } from '../../services/adminSellerService';
import { useToast } from '../../context/ToastContext';

const STATUSES = ['submitted', 'under_review', 'action_required', 'approved', 'rejected', 'suspended', 'draft'];
const NEXT_ACTIONS = {
  submitted: [{ status: 'under_review', label: 'Start review' }, { status: 'approved', label: 'Approve' }, { status: 'rejected', label: 'Reject' }, { status: 'action_required', label: 'Request info' }],
  under_review: [{ status: 'approved', label: 'Approve' }, { status: 'rejected', label: 'Reject' }, { status: 'action_required', label: 'Request info' }],
  action_required: [{ status: 'under_review', label: 'Back to review' }, { status: 'approved', label: 'Approve' }, { status: 'rejected', label: 'Reject' }],
  rejected: [{ status: 'under_review', label: 'Reopen for review' }],
  approved: [{ status: 'suspended', label: 'Suspend' }],
  suspended: [{ status: 'approved', label: 'Reactivate' }],
  draft: [],
};

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [expandedId, setExpandedId] = useState(null);
  const [docUrls, setDocUrls] = useState({});
  const [pendingAction, setPendingAction] = useState(null); // { sellerId, status }
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(null);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    adminListSellers({ limit: 50, status: statusFilter || undefined })
      .then((data) => setSellers(data.sellers || []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-dependency-change pattern
  useEffect(load, [statusFilter]);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const handleViewDoc = async (sellerId, docId) => {
    try {
      const { url } = await adminGetSellerDocumentUrl(sellerId, docId);
      setDocUrls((prev) => ({ ...prev, [docId]: url }));
      window.open(url, '_blank', 'noopener');
    } catch {
      showToast('Could not load document', 'error');
    }
  };

  const requiresNote = (status) => status === 'rejected' || status === 'action_required';

  const applyAction = async (sellerId, status, note) => {
    setUpdating(sellerId);
    try {
      const updated = await adminUpdateSellerStatus(sellerId, status === 'rejected' ? { status, reason: note } : status === 'action_required' ? { status, note } : { status });
      setSellers((prev) => prev.map((s) => (s._id === sellerId ? updated : s)));
      showToast(`Application moved to ${status}`, 'success');
      setPendingAction(null);
      setReason('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update status', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleActionClick = (sellerId, status) => {
    if (requiresNote(status)) {
      setPendingAction({ sellerId, status });
      setReason('');
    } else {
      applyAction(sellerId, status);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Seller Applications</h3>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading applications...</p>
        ) : sellers.length === 0 ? (
          <p className="text-sm text-zinc-400">No applications found.</p>
        ) : (
          sellers.map((seller) => (
            <div key={seller._id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{seller.store?.name || '(no store name)'}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{seller.user?.name} · {seller.user?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {seller.status}
                  </span>
                  <button onClick={() => toggleExpand(seller._id)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700">
                    {expandedId === seller._id ? 'Close' : 'Review'}
                  </button>
                </div>
              </div>

              {expandedId === seller._id && (
                <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div><span className="text-zinc-400">Legal name</span><p className="text-zinc-800 dark:text-zinc-200">{seller.business?.legalName || '—'}</p></div>
                    <div><span className="text-zinc-400">Business type</span><p className="text-zinc-800 dark:text-zinc-200">{seller.business?.businessType || '—'}</p></div>
                    <div><span className="text-zinc-400">GSTIN</span><p className="text-zinc-800 dark:text-zinc-200">{seller.business?.gstin || '—'}</p></div>
                    <div><span className="text-zinc-400">PAN</span><p className="text-zinc-800 dark:text-zinc-200">{seller.business?.panNumber || '—'}</p></div>
                    <div><span className="text-zinc-400">Bank</span><p className="text-zinc-800 dark:text-zinc-200">{seller.payout?.bankName || '—'} ···· {seller.payout?.accountLast4}</p></div>
                    <div><span className="text-zinc-400">Store description</span><p className="text-zinc-800 dark:text-zinc-200">{seller.store?.description || '—'}</p></div>
                  </div>

                  <div>
                    <span className="text-zinc-400">Verification documents</span>
                    {seller.verification?.documents?.length ? (
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {seller.verification.documents.map((doc) => (
                          <li key={doc._id}>
                            <button onClick={() => handleViewDoc(seller._id, doc._id)} className="rounded-lg bg-zinc-100 px-2.5 py-1 font-semibold text-brand-600 dark:bg-zinc-800 dark:text-brand-400">
                              {doc.type} ↗
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-zinc-400">No documents uploaded.</p>
                    )}
                    <p className="mt-1 text-zinc-400">
                      Links are signed and expire shortly — nothing here is a claim of verification until you confirm it yourself.
                    </p>
                  </div>

                  {pendingAction?.sellerId === seller._id ? (
                    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
                      <label className="text-zinc-500">
                        {pendingAction.status === 'rejected' ? 'Rejection reason (required)' : 'Note for the applicant (required)'}
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 h-16 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          disabled={!reason.trim() || updating === seller._id}
                          onClick={() => applyAction(seller._id, pendingAction.status, reason.trim())}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button onClick={() => setPendingAction(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(NEXT_ACTIONS[seller.status] || []).map((action) => (
                        <button
                          key={action.status}
                          disabled={updating === seller._id}
                          onClick={() => handleActionClick(seller._id, action.status)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                            action.status === 'approved' ? 'bg-emerald-600' : action.status === 'rejected' || action.status === 'suspended' ? 'bg-rose-600' : 'bg-brand-600'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
