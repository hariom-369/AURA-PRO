import Order from '../models/Order.js';
import Product from '../models/Product.js';
import SellerTransaction from '../models/SellerTransaction.js';

export async function computeSellerAnalyticsOverview(sellerId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totals, revenueTrend, topProducts, transactionCount, activeProductCount] = await Promise.all([
    SellerTransaction.aggregate([
      { $match: { seller: sellerId, status: { $ne: 'reversed' } } },
      {
        $group: {
          _id: null,
          grossRevenueInPaise: { $sum: '$grossAmountInPaise' },
          commissionPaidInPaise: { $sum: '$commissionAmountInPaise' },
          netEarningsInPaise: { $sum: '$netAmountInPaise' },
        },
      },
    ]),
    SellerTransaction.aggregate([
      { $match: { seller: sellerId, status: { $ne: 'reversed' }, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          netEarningsInPaise: { $sum: '$netAmountInPaise' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.seller': sellerId } },
      {
        $group: {
          _id: '$orderItems.product',
          unitsSold: { $sum: '$orderItems.quantity' },
          revenueInPaise: { $sum: { $multiply: ['$orderItems.priceInPaise', '$orderItems.quantity'] } },
        },
      },
      { $sort: { revenueInPaise: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { name: '$product.name', unitsSold: 1, revenueInPaise: 1 } },
    ]),
    SellerTransaction.countDocuments({ seller: sellerId, status: { $ne: 'reversed' } }),
    Product.countDocuments({ seller: sellerId, isActive: true }),
  ]);

  return {
    grossRevenueInPaise: totals[0]?.grossRevenueInPaise || 0,
    commissionPaidInPaise: totals[0]?.commissionPaidInPaise || 0,
    netEarningsInPaise: totals[0]?.netEarningsInPaise || 0,
    paidOrderItemsCount: transactionCount,
    activeProductCount,
    revenueTrend,
    topProducts,
  };
}
