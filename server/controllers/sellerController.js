import Seller from '../models/Seller.js';
import SellerTransaction from '../models/SellerTransaction.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { encryptSecret, last4 } from '../utils/encryption.js';
import { uploadSellerDocument, getSignedDocumentUrl, deleteSellerDocument } from '../services/sellerDocumentService.js';
import { computeSellerAnalyticsOverview } from '../services/sellerAnalyticsService.js';
import { serializeSellerForApplicant } from '../utils/sellerSerializer.js';

// Once submitted, an application is locked for editing until either the
// admin sends it back with `action_required`, or it's `rejected` (an
// applicant may revise and resubmit rather than starting over).
const EDITABLE_STATUSES = ['draft', 'action_required', 'rejected'];

// Upserts so "start" and "resume" are the same call — there is deliberately
// no separate create-vs-update endpoint, satisfying "avoid creating
// unnecessary duplicate accounts": this always attaches to req.user's own id.
// Contact details are seeded from the existing account (the "Account" step
// is about confirming/adjusting them, not filling in blanks the account
// already has — both email and phone are required at registration).
async function getOrCreateDraft(user) {
  return Seller.findOneAndUpdate(
    { user: user._id },
    {
      $setOnInsert: {
        user: user._id,
        status: 'draft',
        contact: { email: user.email, phone: user.phone },
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
}

function assertEditable(seller) {
  if (!EDITABLE_STATUSES.includes(seller.status)) {
    throw new ApiError(409, `Your application cannot be edited while its status is "${seller.status}".`);
  }
}

// @desc    Get the logged-in user's seller application (null if never started)
// @route   GET /api/v1/seller/application
export const getApplication = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ user: req.user._id });
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Seller application retrieved'));
});

// @desc    Step 1 (Account): confirm/save contact details for the application
// @route   PATCH /api/v1/seller/application/account
export const updateAccountStep = asyncHandler(async (req, res) => {
  const seller = await getOrCreateDraft(req.user);
  assertEditable(seller);

  const { contactEmail, contactPhone } = req.body;
  seller.contact.email = contactEmail ?? seller.contact.email ?? req.user.email;
  seller.contact.phone = contactPhone ?? seller.contact.phone ?? req.user.phone;

  await seller.save();
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Account details saved'));
});

// @desc    Step 2 (Business): legal/business info + store name & description
// @route   PATCH /api/v1/seller/application/business
export const updateBusinessStep = asyncHandler(async (req, res) => {
  const seller = await getOrCreateDraft(req.user);
  assertEditable(seller);

  const { legalName, businessType, country, address, gstin, panNumber, storeName, storeDescription } = req.body;

  if (storeName && storeName !== seller.store.name) {
    const clash = await Seller.findOne({ 'store.name': storeName, _id: { $ne: seller._id } });
    if (clash) throw new ApiError(409, 'That store name is already taken. Please choose another.');
  }

  if (legalName !== undefined) seller.business.legalName = legalName;
  if (businessType !== undefined) seller.business.businessType = businessType;
  if (country !== undefined) seller.business.country = country;
  if (address !== undefined) seller.business.address = address;
  if (gstin !== undefined) seller.business.gstin = gstin;
  if (panNumber !== undefined) seller.business.panNumber = panNumber;
  if (storeName !== undefined) seller.store.name = storeName;
  if (storeDescription !== undefined) seller.store.description = storeDescription;

  await seller.save();
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Business details saved'));
});

// @desc    Step 3 (Verification): upload a document (GST certificate, PAN,
//          address proof, ...). Stored as a Cloudinary `authenticated`
//          asset — see sellerDocumentService — never a public URL.
// @route   POST /api/v1/seller/application/verification/documents
export const uploadVerificationDocument = asyncHandler(async (req, res) => {
  const seller = await getOrCreateDraft(req.user);
  assertEditable(seller);
  if (!req.file) throw new ApiError(400, 'No file provided');

  const { type } = req.body;
  const { publicId, resourceType } = await uploadSellerDocument(req.file.buffer, { sellerId: seller._id, docType: type });
  seller.verification.documents.push({ type, publicId, resourceType });
  await seller.save();

  res.status(201).json(new ApiResponse(201, serializeSellerForApplicant(seller), 'Document uploaded'));
});

// @desc    Remove a previously-uploaded verification document
// @route   DELETE /api/v1/seller/application/verification/documents/:docId
export const deleteVerificationDocument = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ user: req.user._id });
  if (!seller) throw new ApiError(404, 'No application found');
  assertEditable(seller);

  const doc = seller.verification.documents.id(req.params.docId);
  if (!doc) throw new ApiError(404, 'Document not found');

  await deleteSellerDocument(doc.publicId, doc.resourceType);
  doc.deleteOne();
  await seller.save();

  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Document removed'));
});

// @desc    Mint a short-lived signed URL to view one of your own uploaded
//          documents. Generated fresh every call — never persisted/cached.
// @route   GET /api/v1/seller/application/verification/documents/:docId/url
export const getOwnVerificationDocumentUrl = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ user: req.user._id });
  if (!seller) throw new ApiError(404, 'No application found');

  const doc = seller.verification.documents.id(req.params.docId);
  if (!doc) throw new ApiError(404, 'Document not found');

  const url = getSignedDocumentUrl(doc.publicId, doc.resourceType);
  res.status(200).json(new ApiResponse(200, { url }, 'Signed document URL generated'));
});

// @desc    Step 4 (Payment & Fulfillment): payout + pickup/shipping prefs.
//          Full account number/IFSC are encrypted at rest and never read
//          back — only accountLast4 is ever returned by any endpoint.
// @route   PATCH /api/v1/seller/application/payout
export const updatePayoutStep = asyncHandler(async (req, res) => {
  const seller = await getOrCreateDraft(req.user);
  assertEditable(seller);

  const { accountHolderName, bankName, accountNumber, ifsc, pickupAddress, shippingPreferences } = req.body;

  if (accountHolderName !== undefined) seller.payout.accountHolderName = accountHolderName;
  if (bankName !== undefined) seller.payout.bankName = bankName;
  if (accountNumber !== undefined) {
    seller.payout.encryptedAccountNumber = encryptSecret(accountNumber);
    seller.payout.accountLast4 = last4(accountNumber);
  }
  if (ifsc !== undefined) {
    seller.payout.encryptedIfsc = encryptSecret(ifsc);
  }
  if (pickupAddress !== undefined) seller.payout.pickupAddress = pickupAddress;
  if (shippingPreferences?.carrier !== undefined) seller.payout.shippingPreferences.carrier = shippingPreferences.carrier;
  if (shippingPreferences?.notes !== undefined) seller.payout.shippingPreferences.notes = shippingPreferences.notes;

  await seller.save();
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Payout details saved'));
});

// @desc    Step 5 (Review): submit the application for admin review.
// @route   POST /api/v1/seller/application/submit
export const submitApplication = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ user: req.user._id });
  if (!seller) throw new ApiError(404, 'Start your application before submitting it.');
  assertEditable(seller);

  const missing = [];
  if (!seller.business.legalName) missing.push('business legal name');
  if (!seller.store.name) missing.push('store name');
  if (!seller.contact.email && !seller.contact.phone) missing.push('contact email or phone');
  if (!seller.payout.encryptedAccountNumber) missing.push('bank account number');
  if (!seller.payout.encryptedIfsc) missing.push('IFSC code');
  if (seller.verification.documents.length === 0) missing.push('at least one verification document');
  if (missing.length > 0) {
    throw new ApiError(400, `Your application is incomplete: missing ${missing.join(', ')}.`);
  }

  seller.status = 'submitted';
  seller.rejectionReason = null;
  seller.actionRequiredNote = null;
  seller.statusHistory.push({ status: 'submitted', actor: req.user._id, at: new Date() });
  await seller.save();

  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Application submitted for review'));
});

// --- Post-approval, seller-operational endpoints (require an approved,
// non-suspended seller — see requireApprovedSeller in sellerRoutes.js) ---

// @desc    Seller: view/edit store profile settings (unlike the onboarding
//          steps, this stays editable at any time once approved)
// @route   GET /api/v1/seller/store
export const getStoreSettings = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(req.seller), 'Store settings retrieved'));
});

// @route   PUT /api/v1/seller/store
export const updateStoreSettings = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const { storeName, storeDescription, pickupAddress, shippingPreferences } = req.body;

  if (storeName && storeName !== seller.store.name) {
    const clash = await Seller.findOne({ 'store.name': storeName, _id: { $ne: seller._id } });
    if (clash) throw new ApiError(409, 'That store name is already taken. Please choose another.');
    seller.store.name = storeName;
  }
  if (storeDescription !== undefined) seller.store.description = storeDescription;
  if (pickupAddress !== undefined) seller.payout.pickupAddress = pickupAddress;
  if (shippingPreferences?.carrier !== undefined) seller.payout.shippingPreferences.carrier = shippingPreferences.carrier;
  if (shippingPreferences?.notes !== undefined) seller.payout.shippingPreferences.notes = shippingPreferences.notes;

  await seller.save();
  res.status(200).json(new ApiResponse(200, serializeSellerForApplicant(seller), 'Store settings updated'));
});

// @desc    Seller: sales/revenue analytics for their own store
// @route   GET /api/v1/seller/analytics/overview
export const getSellerAnalytics = asyncHandler(async (req, res) => {
  const overview = await computeSellerAnalyticsOverview(req.seller._id);
  res.status(200).json(new ApiResponse(200, overview, 'Seller analytics retrieved'));
});

// @desc    Seller: their own commission ledger (bookkeeping only — see
//          SellerTransaction's model comment; no real payout is issued here)
// @route   GET /api/v1/seller/transactions
export const listSellerTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = { seller: req.seller._id };

  const [transactions, total] = await Promise.all([
    SellerTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    SellerTransaction.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Transactions retrieved')
  );
});

// @desc    Seller: reviews left on their own products (read-only)
// @route   GET /api/v1/seller/reviews
export const listSellerProductReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const productIds = await Product.find({ seller: req.seller._id }).distinct('_id');
  const filter = { product: { $in: productIds } };

  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('product', 'name slug').populate('user', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Reviews retrieved')
  );
});
