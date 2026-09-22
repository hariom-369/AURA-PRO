import Product from '../../models/Product.js';

// Content-based recommendations (category/tag overlap + rating), driven by
// the seed products passed in (recently-viewed / cart items the client already
// tracks). No separate event-tracking pipeline exists, so this intentionally
// stays a pure DB query — fast, free, and the candidate set is always real.
async function candidatesFromSeed(seedProducts, excludeIds, limit) {
  const categories = [...new Set(seedProducts.map((p) => p.category).filter(Boolean))];
  const tags = [...new Set(seedProducts.flatMap((p) => p.tags || []))];

  if (categories.length === 0 && tags.length === 0) return [];

  return Product.find({
    _id: { $nin: excludeIds },
    isActive: true,
    $or: [
      ...(categories.length ? [{ category: { $in: categories } }] : []),
      ...(tags.length ? [{ tags: { $in: tags } }] : []),
    ],
  })
    .sort({ rating: -1, numReviews: -1 })
    .limit(limit)
    .lean();
}

export async function getSimilarProducts(productId, { limit = 6 } = {}) {
  const product = await Product.findById(productId).lean();
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  const products = await candidatesFromSeed([product], [product._id], limit);
  return { products, basis: 'content-similarity' };
}

export async function getPersonalizedRecommendations({ recentlyViewedIds = [], cartProductIds = [], limit = 8 } = {}) {
  const seedIds = [...new Set([...recentlyViewedIds, ...cartProductIds])].filter(Boolean);

  if (seedIds.length === 0) {
    const fallback = await Product.find({ isActive: true, isFeatured: true })
      .sort({ rating: -1 })
      .limit(limit)
      .lean();
    return { products: fallback, basis: 'featured' };
  }

  const seedProducts = await Product.find({ _id: { $in: seedIds } }).lean();
  const products = await candidatesFromSeed(seedProducts, seedIds, limit);
  return { products, basis: 'content-similarity' };
}
