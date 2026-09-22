import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import { createMessage, FAST_MODEL, isAIAvailable } from './client.js';

const BUNDLE_LABEL_TOOL = {
  name: 'label_bundle',
  description: 'Write a short, appealing label for a product bundle, using only the given product names.',
  input_schema: {
    type: 'object',
    properties: { label: { type: 'string', description: 'Under 8 words, e.g. "Complete your workspace setup".' } },
    required: ['label'],
  },
};

// "Frequently bought together" driven by real Order history (genuine
// co-purchase signal), falling back to same-category products for a new
// catalog with no order history yet. Gemini only ever writes the cosmetic
// label — it never chooses the candidate set.
export async function getFrequentlyBoughtWith(productId, { limit = 4 } = {}) {
  const seed = await Product.findById(productId).lean();
  if (!seed) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const objectId = new mongoose.Types.ObjectId(productId);

  const coOccurrence = await Order.aggregate([
    { $match: { 'orderItems.product': objectId } },
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.product': { $ne: objectId } } },
    { $group: { _id: '$orderItems.product', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  let candidateIds = coOccurrence.map((c) => c._id);
  let basis = 'purchase-history';

  if (candidateIds.length === 0) {
    const fallback = await Product.find({ _id: { $ne: objectId }, category: seed.category, isActive: true })
      .sort({ rating: -1 })
      .limit(limit)
      .lean();
    candidateIds = fallback.map((p) => p._id);
    basis = 'same-category';
  }

  const products = await Product.find({ _id: { $in: candidateIds }, isActive: true }).lean();

  let label = null;
  if (isAIAvailable() && products.length > 0) {
    try {
      const response = await createMessage({
        model: FAST_MODEL,
        max_tokens: 100,
        system: 'You write short, appealing bundle labels from real product names only. Never invent a discount or claim.',
        messages: [
          { role: 'user', content: JSON.stringify({ anchor: seed.name, bundle: products.map((p) => p.name) }) },
        ],
        tools: [BUNDLE_LABEL_TOOL],
        tool_choice: { type: 'tool', name: 'label_bundle' },
      });
      const toolUse = response.content.find((b) => b.type === 'tool_use');
      label = toolUse?.input?.label || null;
    } catch {
      label = null; // Cosmetic only — never block the bundle itself on AI failure.
    }
  }

  return { products, basis, label };
}
