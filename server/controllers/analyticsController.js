import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

// Shared by the HTTP overview endpoint and the AI insights endpoint, so both
// always reflect the exact same real numbers.
export async function computeAnalyticsOverview() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    revenueAgg,
    ordersCount,
    pendingOrdersCount,
    lowStockCount,
    statusBreakdown,
    revenueTrend,
    topProducts,
    totalCustomers,
    newCustomers30d,
    topCustomers,
  ] = await Promise.all([
    Order.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: '$totalPriceInPaise' } } }]),
    Order.countDocuments({}),
    Order.countDocuments({ status: 'PENDING' }),
    Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { isPaid: true, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenueInPaise: { $sum: '$totalPriceInPaise' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
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
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: thirtyDaysAgo } }),
    Order.aggregate([
      { $match: { isPaid: true, user: { $ne: null } } },
      { $group: { _id: '$user', totalSpentInPaise: { $sum: '$totalPriceInPaise' }, orders: { $sum: 1 } } },
      { $sort: { totalSpentInPaise: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', email: '$user.email', totalSpentInPaise: 1, orders: 1 } },
    ]),
  ]);

  const totalRevenueInPaise = revenueAgg[0]?.total || 0;
  const avgOrderValueInPaise = ordersCount > 0 ? Math.round(totalRevenueInPaise / ordersCount) : 0;

  return {
    totalRevenueInPaise,
    ordersCount,
    pendingOrdersCount,
    lowStockCount,
    avgOrderValueInPaise,
    statusBreakdown,
    revenueTrend,
    topProducts,
    totalCustomers,
    newCustomers30d,
    topCustomers,
  };
}

// @desc    Admin dashboard analytics: revenue, orders, low stock, trend, top products, customers
// @route   GET /api/v1/admin/analytics/overview
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const overview = await computeAnalyticsOverview();
  res.status(200).json(new ApiResponse(200, overview, 'Analytics overview'));
});

// @desc    Admin: products at or below their low-stock threshold
// @route   GET /api/v1/admin/products/low-stock
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
    .select('name stock lowStockThreshold sku')
    .sort({ stock: 1 })
    .lean();
  res.status(200).json(new ApiResponse(200, products, 'Low stock products'));
});
