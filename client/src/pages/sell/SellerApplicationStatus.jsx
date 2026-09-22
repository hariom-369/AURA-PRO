import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeller } from '../../context/SellerContext';

const STATUS_COPY = {
  draft: { title: 'Application not yet submitted', body: 'You have a draft application. Finish and submit it to begin review.', tone: 'zinc' },
  submitted: { title: 'Application submitted', body: 'Your application is in the queue for review. We\'ll update this page as it progresses.', tone: 'brand' },
  under_review: { title: 'Under review', body: 'An AURA PRO admin is currently reviewing your application.', tone: 'brand' },
  action_required: { title: 'Action required', body: 'We need a bit more information before we can continue.', tone: 'amber' },
  approved: { title: 'Approved', body: 'Your seller account is approved — head to your dashboard to get started.', tone: 'emerald' },
  rejected: { title: 'Application rejected', body: 'Your application was not approved this time, but you can revise and resubmit.', tone: 'rose' },
  suspended: { title: 'Account suspended', body: 'Your seller account has been suspended. Contact support for details.', tone: 'rose' },
};

const TONE_CLASSES = {
  zinc: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  brand: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
};

export default function SellerApplicationStatus() {
  const { application, loading } = useSeller();
  const navigate = useNavigate();

  useEffect(() => {
    if (application?.status === 'approved') navigate('/seller', { replace: true });
  }, [application, navigate]);

  if (loading) return null;

  if (!application) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">No application found</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">You haven't started a seller application yet.</p>
        <Link to="/sell" className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">
          Start your application
        </Link>
      </div>
    );
  }

  const copy = STATUS_COPY[application.status] || STATUS_COPY.draft;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className={`rounded-2xl border p-6 ${TONE_CLASSES[copy.tone]}`}>
        <h1 className="text-lg font-bold">{copy.title}</h1>
        <p className="mt-2 text-sm">{copy.body}</p>
        {application.status === 'action_required' && application.actionRequiredNote && (
          <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium dark:bg-black/20">{application.actionRequiredNote}</p>
        )}
        {application.status === 'rejected' && application.rejectionReason && (
          <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium dark:bg-black/20">{application.rejectionReason}</p>
        )}
      </div>

      {['draft', 'action_required', 'rejected'].includes(application.status) && (
        <Link to="/sell/onboarding" className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">
          {application.status === 'draft' ? 'Continue application' : 'Revise application'}
        </Link>
      )}

      {application.statusHistory?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Timeline</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {[...application.statusHistory].reverse().map((h, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{h.status}</span>
                <span className="ml-2 text-xs text-zinc-400">{new Date(h.at).toLocaleString()}</span>
                {h.note && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{h.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
