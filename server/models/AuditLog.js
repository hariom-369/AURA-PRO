import mongoose from 'mongoose';

// An append-only trail of sensitive administrative actions (seller
// approve/reject/suspend, user role/status changes, refund approvals, order
// status overrides). Never updated or deleted by application code.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true }, // e.g. 'seller.status_change', 'user.role_change'
    targetType: { type: String, required: true }, // e.g. 'Seller', 'User', 'Order'
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
