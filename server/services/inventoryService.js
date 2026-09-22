import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendLowStockAlertEmail } from './emailService.js';
import logger from '../utils/logger.js';

/**
 * Atomic stock updates to prevent overselling.
 */
async function reserveAndDeductStock(items, session = null) {
  for (const item of items) {
    if (item.sku) {
      // Update specific variant stock
      const result = await Product.updateOne(
        { _id: item.product, "variants.sku": item.sku, "variants.stock": { $gte: item.quantity } },
        { $inc: { "variants.$.stock": -item.quantity, stock: -item.quantity } },
        { session }
      );
      if (result.modifiedCount === 0) {
        throw new Error(`Stock reservation failed for SKU ${item.sku}. Item out of stock.`);
      }
    } else {
      // Update base product stock
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { session }
      );
      if (result.modifiedCount === 0) {
        throw new Error(`Stock reservation failed for item ID ${item.product}.`);
      }
    }
  }
}

async function restoreStock(items) {
  for (const item of items) {
    if (item.sku) {
      await Product.updateOne(
        { _id: item.product, "variants.sku": item.sku },
        { $inc: { "variants.$.stock": item.quantity, stock: item.quantity } }
      );
    } else {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
      );
    }
  }
}

// Checks products for low stock after a deduction and emails admins. Never
// throws — a failed alert must not affect the order that triggered it.
async function checkAndAlertLowStock(productIds) {
  try {
    const products = await Product.find({
      _id: { $in: productIds },
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    }).lean();

    if (products.length === 0) return;

    const admins = await User.find({ role: 'admin' }).select('email').lean();
    for (const product of products) {
      logger.warn('low_stock_alert', { product: product.name, stock: product.stock, threshold: product.lowStockThreshold });
      for (const admin of admins) {
        await sendLowStockAlertEmail(admin.email, product);
      }
    }
  } catch (error) {
    logger.error('low_stock_alert_failed', { error: error.message });
  }
}

export { reserveAndDeductStock, restoreStock, checkAndAlertLowStock };