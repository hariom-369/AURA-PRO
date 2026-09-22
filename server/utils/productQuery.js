// Shared product filter/sort query builder, used by both the regular product
// listing endpoint and the AI semantic search endpoint so the two stay consistent.

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildProductQuery({ search, category, brand, minPrice, maxPrice, minRating, sort } = {}) {
  const query = {};

  if (search && String(search).trim()) {
    query.$text = { $search: String(search).trim() };
  }

  if (category && category !== 'All') {
    query.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, 'i') };
  }

  if (brand) {
    query.brand = { $regex: new RegExp(`^${escapeRegex(brand)}$`, 'i') };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (minRating) {
    query.rating = { $gte: Number(minRating) };
  }

  let sortSpec;
  switch (sort) {
    case 'price-low': sortSpec = { price: 1 }; break;
    case 'price-high': sortSpec = { price: -1 }; break;
    case 'newest': sortSpec = { createdAt: -1 }; break;
    case 'rating': sortSpec = { rating: -1 }; break;
    default: sortSpec = { createdAt: -1 };
  }

  return { query, sort: sortSpec };
}
