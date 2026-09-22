import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSeller } from '../../context/SellerContext';
import { useToast } from '../../context/ToastContext';
import {
  updateAccountStep,
  updateBusinessStep,
  updatePayoutStep,
  submitSellerApplication,
  uploadVerificationDocument,
  deleteVerificationDocument,
} from '../../services/sellerService';

const STEPS = ['Account', 'Business', 'Verification', 'Payment & Fulfillment', 'Review'];
const BUSINESS_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'pvt_ltd', label: 'Private Limited' },
  { value: 'llp', label: 'LLP' },
  { value: 'other', label: 'Other' },
];
const DOC_TYPES = [
  { value: 'gstin_certificate', label: 'GST certificate' },
  { value: 'pan_card', label: 'PAN card' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'bank_proof', label: 'Bank proof (cancelled cheque / statement)' },
  { value: 'other', label: 'Other' },
];

const inputClass =
  'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const labelClass = 'text-xs font-medium text-zinc-500';

function StepShell({ title, description, children, onBack, onNext, nextLabel = 'Continue', saving, canGoBack = true }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      <div className="mt-5 flex flex-col gap-3">{children}</div>
      <div className="mt-6 flex items-center justify-between">
        {canGoBack ? (
          <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onNext}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : nextLabel}
        </button>
      </div>
    </div>
  );
}

export default function SellerOnboarding() {
  const { user } = useAuth();
  const { application, refresh } = useSeller();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [account, setAccount] = useState({ contactEmail: '', contactPhone: '' });
  const [business, setBusiness] = useState({
    legalName: '', businessType: 'individual', storeName: '', storeDescription: '',
    address: { line1: '', city: '', state: '', postalCode: '', country: 'India' },
    gstin: '', panNumber: '',
  });
  const [payout, setPayout] = useState({
    accountHolderName: '', bankName: '', accountNumber: '', ifsc: '',
    pickupAddress: { line1: '', city: '', state: '', postalCode: '', country: 'India' },
  });
  const [docType, setDocType] = useState('gstin_certificate');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!application) return;
    setAccount({ contactEmail: application.contact?.email || '', contactPhone: application.contact?.phone || '' });
    setBusiness((prev) => ({
      ...prev,
      legalName: application.business?.legalName || '',
      businessType: application.business?.businessType || 'individual',
      storeName: application.store?.name || '',
      storeDescription: application.store?.description || '',
      address: application.business?.address || prev.address,
      gstin: application.business?.gstin || '',
      panNumber: application.business?.panNumber || '',
    }));
    setPayout((prev) => ({
      ...prev,
      accountHolderName: application.payout?.accountHolderName || '',
      bankName: application.payout?.bankName || '',
      pickupAddress: application.payout?.pickupAddress || prev.pickupAddress,
    }));
  }, [application]);

  if (application && !['draft', 'action_required', 'rejected'].includes(application.status)) {
    navigate('/sell/status', { replace: true });
    return null;
  }

  const runStep = async (fn, next) => {
    setError('');
    setSaving(true);
    try {
      await fn();
      await refresh();
      if (next !== undefined) setStep(next);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this step. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadVerificationDocument(docType, file);
      await refresh();
      showToast('Document uploaded', 'success');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await deleteVerificationDocument(docId);
      await refresh();
    } catch {
      showToast('Could not remove document', 'error');
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      await submitSellerApplication();
      await refresh();
      showToast('Application submitted for review', 'success');
      navigate('/sell/status');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your application');
    } finally {
      setSaving(false);
    }
  };

  const documents = application?.verification?.documents || [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Sell on AURA PRO</h1>
      {application?.status === 'action_required' && application.actionRequiredNote && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <strong>Action required:</strong> {application.actionRequiredNote}
        </div>
      )}
      {application?.status === 'rejected' && application.rejectionReason && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <strong>Your previous application was rejected:</strong> {application.rejectionReason}. You can revise and resubmit below.
        </div>
      )}

      <div className="mt-5 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
        {STEPS.map((label, i) => (
          <div key={label} className="flex shrink-0 items-center gap-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i <= step ? 'bg-brand-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>
              {i + 1}
            </span>
            <span className={i === step ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-zinc-300 dark:bg-zinc-700" />}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>}

        {step === 0 && (
          <StepShell
            title="Confirm your account"
            description={`Applying as ${user?.name} (${user?.email}). You'll use this account to manage your store.`}
            onNext={() => runStep(() => updateAccountStep(account), 1)}
            saving={saving}
            canGoBack={false}
          >
            <label className={labelClass}>Contact email for buyers</label>
            <input className={inputClass} value={account.contactEmail} onChange={(e) => setAccount({ ...account, contactEmail: e.target.value })} />
            <label className={labelClass}>Contact phone</label>
            <input className={inputClass} value={account.contactPhone} onChange={(e) => setAccount({ ...account, contactPhone: e.target.value })} />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Business information"
            onBack={() => setStep(0)}
            onNext={() =>
              runStep(
                () =>
                  updateBusinessStep({
                    legalName: business.legalName,
                    businessType: business.businessType,
                    storeName: business.storeName,
                    storeDescription: business.storeDescription,
                    address: business.address,
                    gstin: business.gstin,
                    panNumber: business.panNumber,
                  }),
                2
              )
            }
            saving={saving}
          >
            <label className={labelClass}>Business / legal name</label>
            <input className={inputClass} value={business.legalName} onChange={(e) => setBusiness({ ...business, legalName: e.target.value })} />
            <label className={labelClass}>Business type</label>
            <select className={inputClass} value={business.businessType} onChange={(e) => setBusiness({ ...business, businessType: e.target.value })}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className={labelClass}>Store name</label>
            <input className={inputClass} value={business.storeName} onChange={(e) => setBusiness({ ...business, storeName: e.target.value })} />
            <label className={labelClass}>Store description</label>
            <textarea className={`h-20 resize-none ${inputClass}`} value={business.storeDescription} onChange={(e) => setBusiness({ ...business, storeDescription: e.target.value })} />
            <label className={labelClass}>Business address</label>
            <input className={inputClass} placeholder="Address line" value={business.address.line1} onChange={(e) => setBusiness({ ...business, address: { ...business.address, line1: e.target.value } })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="City" value={business.address.city} onChange={(e) => setBusiness({ ...business, address: { ...business.address, city: e.target.value } })} />
              <input className={inputClass} placeholder="State" value={business.address.state} onChange={(e) => setBusiness({ ...business, address: { ...business.address, state: e.target.value } })} />
              <input className={inputClass} placeholder="Postal code" value={business.address.postalCode} onChange={(e) => setBusiness({ ...business, address: { ...business.address, postalCode: e.target.value } })} />
              <input className={inputClass} placeholder="Country" value={business.address.country} onChange={(e) => setBusiness({ ...business, address: { ...business.address, country: e.target.value } })} />
            </div>
            <label className={labelClass}>GSTIN (India — if applicable)</label>
            <input className={inputClass} value={business.gstin} onChange={(e) => setBusiness({ ...business, gstin: e.target.value })} />
            <label className={labelClass}>PAN number</label>
            <input className={inputClass} value={business.panNumber} onChange={(e) => setBusiness({ ...business, panNumber: e.target.value })} />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Verification documents" onBack={() => setStep(1)} onNext={() => setStep(3)} saving={saving}>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Upload documents supporting your business details above. These are stored securely and only reviewed by
              AURA PRO admins — an admin must manually confirm them before your application can be approved; uploading
              a document does not by itself mark anything as "verified."
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading}
                onChange={(e) => handleUploadDoc(e.target.files?.[0])}
                className="block text-xs text-zinc-500"
              />
            </div>
            {uploading && <p className="text-xs text-zinc-400">Uploading...</p>}
            {documents.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {documents.map((doc) => (
                  <li key={doc._id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-950">
                    <span>{DOC_TYPES.find((t) => t.value === doc.type)?.label || doc.type}</span>
                    <button onClick={() => handleDeleteDoc(doc._id)} className="font-semibold text-rose-500">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Payment & fulfillment"
            description="Used to pay out your earnings and coordinate pickups. Full account details are encrypted and never shown again — only the last 4 digits are kept visible."
            onBack={() => setStep(2)}
            onNext={() =>
              runStep(() => {
                const payload = { ...payout };
                if (!payload.accountNumber) delete payload.accountNumber;
                if (!payload.ifsc) delete payload.ifsc;
                return updatePayoutStep(payload);
              }, 4)
            }
            saving={saving}
          >
            <label className={labelClass}>Account holder name</label>
            <input className={inputClass} value={payout.accountHolderName} onChange={(e) => setPayout({ ...payout, accountHolderName: e.target.value })} />
            <label className={labelClass}>Bank name</label>
            <input className={inputClass} value={payout.bankName} onChange={(e) => setPayout({ ...payout, bankName: e.target.value })} />
            <label className={labelClass}>
              Account number {application?.payout?.accountLast4 && <span className="text-zinc-400">(on file, ending {application.payout.accountLast4})</span>}
            </label>
            <input className={inputClass} placeholder={application?.payout?.hasBankDetails ? 'Leave blank to keep existing' : ''} value={payout.accountNumber} onChange={(e) => setPayout({ ...payout, accountNumber: e.target.value })} />
            <label className={labelClass}>IFSC code</label>
            <input className={inputClass} placeholder={application?.payout?.hasBankDetails ? 'Leave blank to keep existing' : ''} value={payout.ifsc} onChange={(e) => setPayout({ ...payout, ifsc: e.target.value.toUpperCase() })} />
            <label className={labelClass}>Pickup address</label>
            <input className={inputClass} placeholder="Address line" value={payout.pickupAddress.line1} onChange={(e) => setPayout({ ...payout, pickupAddress: { ...payout.pickupAddress, line1: e.target.value } })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="City" value={payout.pickupAddress.city} onChange={(e) => setPayout({ ...payout, pickupAddress: { ...payout.pickupAddress, city: e.target.value } })} />
              <input className={inputClass} placeholder="Postal code" value={payout.pickupAddress.postalCode} onChange={(e) => setPayout({ ...payout, pickupAddress: { ...payout.pickupAddress, postalCode: e.target.value } })} />
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Review & submit"
            description="Once submitted, your details are locked until an admin approves, rejects, or requests more information."
            onBack={() => setStep(3)}
            onNext={handleSubmit}
            nextLabel="Submit application"
            saving={saving}
          >
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><span className={labelClass}>Store</span><p className="text-zinc-900 dark:text-zinc-50">{business.storeName || '—'}</p></div>
              <div><span className={labelClass}>Legal name</span><p className="text-zinc-900 dark:text-zinc-50">{business.legalName || '—'}</p></div>
              <div><span className={labelClass}>Contact</span><p className="text-zinc-900 dark:text-zinc-50">{account.contactEmail || '—'}</p></div>
              <div><span className={labelClass}>Bank account</span><p className="text-zinc-900 dark:text-zinc-50">{application?.payout?.accountLast4 ? `···· ${application.payout.accountLast4}` : 'Not yet saved'}</p></div>
              <div><span className={labelClass}>Documents uploaded</span><p className="text-zinc-900 dark:text-zinc-50">{documents.length}</p></div>
            </div>
          </StepShell>
        )}
      </div>
    </div>
  );
}
