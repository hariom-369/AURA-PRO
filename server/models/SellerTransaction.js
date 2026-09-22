import mongoose from 'mongoose';

// A bookkeeping ledger entry, NOT a real payout/transfer — no money actually
// moves through this app. One entry is written per seller per paid order
// (see the Stripe webhook handler), recording a snapshot of what that
// seller's cut of the sale is. Settlement to the seller's bank account
// happens off-platform; `status` just tracks whether the amount has cleared
// the (currently unmodeled) return/refund window.
const sellerTransactionSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    grossAmountInPaise: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmountInPaise: { type: Number, required: true, min: 0 },
    netAmountInPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'available', 'paid_out', 'reversed'], default: 'pending', index: true },
  },
  { timestamps: true }
);

// One ledger entry per order item — guards against the webhook firing twice.
sellerTransactionSchema.index({ order: 1, orderItemId: 1 }, { unique: true });

export default mongoose.model('SellerTransaction', sellerTransactionSchema);
