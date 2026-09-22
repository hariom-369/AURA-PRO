// Shared shape for returning a Seller doc over the API. Never includes
// encrypted payout fields or raw document storage identifiers — those are
// only ever resolved on demand (see sellerDocumentService.getSignedDocumentUrl).
function baseSerialize(seller) {
  if (!seller) return null;
  const obj = typeof seller.toObject === 'function' ? seller.toObject() : seller;
  return {
    _id: obj._id,
    status: obj.status,
    rejectionReason: obj.rejectionReason,
    actionRequiredNote: obj.actionRequiredNote,
    business: obj.business,
    store: obj.store,
    contact: obj.contact,
    verification: {
      verified: obj.verification?.verified || false,
      notes: obj.verification?.notes || '',
      documents: (obj.verification?.documents || []).map((d) => ({ _id: d._id, type: d.type, uploadedAt: d.uploadedAt })),
    },
    payout: {
      accountHolderName: obj.payout?.accountHolderName || '',
      bankName: obj.payout?.bankName || '',
      accountLast4: obj.payout?.accountLast4 || '',
      hasBankDetails: Boolean(obj.payout?.encryptedAccountNumber),
      pickupAddress: obj.payout?.pickupAddress,
      shippingPreferences: obj.payout?.shippingPreferences,
    },
    commissionPercent: obj.commissionPercent,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function serializeSellerForApplicant(seller) {
  if (!seller) return null;
  const base = baseSerialize(seller);
  base.statusHistory = (seller.statusHistory || []).map((h) => ({ status: h.status, note: h.note, at: h.at }));
  return base;
}

export function serializeSellerForAdmin(seller) {
  if (!seller) return null;
  const base = baseSerialize(seller);
  base.user = seller.user;
  base.statusHistory = seller.statusHistory || [];
  return base;
}
