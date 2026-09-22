import Seller from '../models/Seller.js';
import SellerTransaction from '../models/SellerTransaction.js';
import logger from '../utils/logger.js';

function defaultCommissionPercent() {
  return Number(process.env.MARKETPLACE_DEFAULT_COMMISSION_PERCENT) || 0;
}

// Writes one ledger entry per seller-owned order item, once a payment is
// confirmed. Called from the Stripe webhook, after the order is marked paid.
// No money moves here — this is bookkeeping only (see SellerTransaction's
// model comment). Safe to call more than once for the same order: each
// entry is keyed uniquely on (order, orderItemId), and duplicates are
// swallowed rather than thrown, since the caller's own `!order.isPaid` guard
// is the primary defense and this is a secondary safety net.
export async function recordSellerTransactionsForOrder(order) {
  const sellerItems = order.orderItems.filter((item) => item.seller);
  if (sellerItems.length === 0) return;

  const sellerIds = [...new Set(sellerItems.map((item) => item.seller.toString()))];
  const sellers = await Seller.find({ _id: { $in: sellerIds } }).select('commissionPercent');
  const commissionBySeller = new Map(
    sellers.map((s) => [s._id.toString(), s.commissionPercent ?? defaultCommissionPercent()])
  );

  for (const item of sellerItems) {
    const sellerId = item.seller.toString();
    const commissionPercent = commissionBySeller.get(sellerId) ?? defaultCommissionPercent();
    const grossAmountInPaise = (item.priceInPaise || 0) * item.quantity;
    const commissionAmountInPaise = Math.round((grossAmountInPaise * commissionPercent) / 100);
    const netAmountInPaise = grossAmountInPaise - commissionAmountInPaise;

    try {
      await SellerTransaction.create({
        seller: item.seller,
        order: order._id,
        orderItemId: item._id,
        grossAmountInPaise,
        commissionPercent,
        commissionAmountInPaise,
        netAmountInPaise,
        status: 'pending',
      });
    } catch (error) {
      if (error.code === 11000) continue; // already recorded for this order item
      logger.error('seller_transaction_write_failed', { orderId: order._id.toString(), orderItemId: item._id.toString(), error: error.message });
    }
  }
}
