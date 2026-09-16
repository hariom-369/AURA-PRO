const Product = require('../models/Product');

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

module.exports = { reserveAndDeductStock, restoreStock };