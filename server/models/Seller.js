import mongoose from 'mongoose';

// A seller "profile/application" — deliberately NOT a duplicate account.
// Exactly one Seller doc per User (see the unique index below); a customer
// becomes a seller by gaining one of these, never by losing or replacing
// their User row. Authorization checks this doc's `status`, not User.role.
const STATUSES = ['draft', 'submitted', 'under_review', 'action_required', 'approved', 'rejected', 'suspended'];

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. 'gstin_certificate', 'pan_card', 'address_proof'
    // Cloudinary `public_id` only — NOT a servable URL. Uploaded with
    // `type: 'authenticated'` (access-restricted at the Cloudinary layer, not
    // just "hard to guess"); a viewable URL is minted on demand, signed and
    // time-limited, by sellerDocumentService.getSignedDocumentUrl — never
    // stored or cached as a standing public link.
    publicId: { type: String, required: true },
    resourceType: { type: String, default: 'image' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const sellerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    status: { type: String, enum: STATUSES, default: 'draft', index: true },
    statusHistory: [statusHistorySchema],
    rejectionReason: { type: String, default: null },
    actionRequiredNote: { type: String, default: null },

    business: {
      legalName: { type: String, default: '' },
      businessType: {
        type: String,
        enum: ['individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'other'],
        default: 'individual',
      },
      country: { type: String, default: 'India' },
      address: addressSchema,
      gstin: { type: String, default: '' },
      panNumber: { type: String, default: '' },
    },

    store: {
      name: { type: String, default: '', trim: true },
      description: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      bannerUrl: { type: String, default: '' },
    },

    contact: {
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },

    // Never auto-set `verified: true` — only an explicit admin review action
    // may do that (see adminSellerController). No automated GSTIN-lookup
    // integration exists; this is storage + a manual review trail, not a
    // verification service.
    verification: {
      documents: [documentSchema],
      verified: { type: Boolean, default: false },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: String, default: '' },
    },

    // Minimal, encrypted-at-rest payout details — see server/utils/encryption.js.
    // Full account number/IFSC are never returned by any API; only
    // accountLast4 (plaintext, safe to display) is.
    payout: {
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountLast4: { type: String, default: '' },
      encryptedAccountNumber: { type: String, default: null },
      encryptedIfsc: { type: String, default: null },
      pickupAddress: addressSchema,
      shippingPreferences: {
        carrier: { type: String, default: '' },
        notes: { type: String, default: '' },
      },
    },

    // null = use MARKETPLACE_DEFAULT_COMMISSION_PERCENT.
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true }
);

export const SELLER_STATUSES = STATUSES;
export default mongoose.model('Seller', sellerSchema);
