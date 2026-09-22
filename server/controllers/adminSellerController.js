import Seller from '../models/Seller.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getSignedDocumentUrl } from '../services/sellerDocumentService.js';
import { serializeSellerForAdmin } from '../utils/sellerSerializer.js';
import { recordAuditLog } from '../services/auditLogService.js';

// What an admin may move a seller TO, keyed by current status. `draft` has
// no admin-initiated transitions — only the applicant moves it, by
// submitting. This is deliberately a little permissive (e.g. `submitted`
// can go straight to `approved`, skipping `under_review`) rather than a
// rigid state machine, since real review workflows vary by admin.
const LEGAL_TRANSITIONS = {
  draft: [],
  submitted: ['under_review', 'approved', 'rejected', 'action_required'],
  under_review: ['approved', 'rejected', 'action_required'],
  action_required: ['under_review', 'approved', 'rejected'],
  rejected: ['under_review'],
  approved: ['suspended'],
  suspended: ['approved'],
};

// @desc    Admin: list seller applications, optionally filtered by status
// @route   GET /api/v1/admin/sellers
export const adminListSellers = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const [sellers, total] = await Promise.all([
    Seller.find(filter).populate('user', 'name email phone').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Seller.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { sellers: sellers.map(serializeSellerForAdmin), pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      'Seller applications retrieved'
    )
  );
});

// @desc    Admin: view one seller application in full
// @route   GET /api/v1/admin/sellers/:id
export const adminGetSeller = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id).populate('user', 'name email phone createdAt');
  if (!seller) throw new ApiError(404, 'Seller application not found');
  res.status(200).json(new ApiResponse(200, serializeSellerForAdmin(seller), 'Seller application retrieved'));
});

// @desc    Admin: mint a signed URL to view one of this seller's uploaded
//          verification documents (short-lived, generated fresh every call)
// @route   GET /api/v1/admin/sellers/:id/documents/:docId/url
export const adminGetSellerDocumentUrl = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id);
  if (!seller) throw new ApiError(404, 'Seller application not found');

  const doc = seller.verification.documents.id(req.params.docId);
  if (!doc) throw new ApiError(404, 'Document not found');

  const url = getSignedDocumentUrl(doc.publicId, doc.resourceType);
  res.status(200).json(new ApiResponse(200, { url }, 'Signed document URL generated'));
});

// @desc    Admin: approve / reject / suspend / reactivate / request more info
// @route   PATCH /api/v1/admin/sellers/:id/status
export const adminUpdateSellerStatus = asyncHandler(async (req, res) => {
  const { status, reason, note } = req.body;

  const seller = await Seller.findById(req.params.id);
  if (!seller) throw new ApiError(404, 'Seller application not found');

  const allowed = LEGAL_TRANSITIONS[seller.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot move a "${seller.status}" application to "${status}".`);
  }
  if (status === 'rejected' && !reason) {
    throw new ApiError(400, 'A rejection reason is required.');
  }
  if (status === 'action_required' && !note) {
    throw new ApiError(400, 'A note describing what is needed is required.');
  }

  const previousStatus = seller.status;
  seller.status = status;
  seller.rejectionReason = status === 'rejected' ? reason : null;
  seller.actionRequiredNote = status === 'action_required' ? note : null;
  seller.statusHistory.push({ status, note: note || reason || '', actor: req.user._id, at: new Date() });
  await seller.save();

  await recordAuditLog({
    actor: req.user._id,
    action: 'seller.status_change',
    targetType: 'Seller',
    targetId: seller._id,
    metadata: { from: previousStatus, to: status, reason, note },
  });

  res.status(200).json(new ApiResponse(200, serializeSellerForAdmin(seller), `Seller application moved to ${status}`));
});
