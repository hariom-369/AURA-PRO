import Product from '../../models/Product.js';
import { createMessage, CHAT_MODEL, isAIAvailable } from './client.js';

const COMPARISON_TOOL = {
  name: 'build_comparison',
  description: 'Structured side-by-side comparison of the given products, using only the provided data.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'One or two sentence overview of the key differences.' },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            attribute: { type: 'string' },
            values: { type: 'array', items: { type: 'string' } },
          },
          required: ['attribute', 'values'],
        },
      },
      recommendation: {
        type: 'string',
        description: 'Which product might suit which kind of buyer, based only on the given data. Empty string if not clear.',
      },
    },
    required: ['summary', 'rows', 'recommendation'],
  },
};

export async function compareProducts(productIds) {
  if (!Array.isArray(productIds) || productIds.length < 2 || productIds.length > 4) {
    const err = new Error('Provide between 2 and 4 product IDs to compare');
    err.statusCode = 400;
    throw err;
  }

  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  if (products.length < 2) {
    const err = new Error('At least 2 valid, active products are required to compare');
    err.statusCode = 400;
    throw err;
  }

  const catalogData = products.map((p) => ({
    id: p._id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPercentage: p.discountPercentage,
    rating: p.rating,
    numReviews: p.numReviews,
    inStock: p.stock > 0,
    stock: p.stock,
    specifications: p.specifications,
    tags: p.tags,
  }));

  if (!isAIAvailable()) {
    // Graceful fallback: raw comparable data without an AI narrative.
    return { products: catalogData, summary: null, rows: null, recommendation: null, aiGenerated: false };
  }

  const response = await createMessage({
    model: CHAT_MODEL,
    max_tokens: 700,
    system:
      'You compare e-commerce products strictly from the JSON data given to you. Never invent a spec, price, or feature not present in the data. If a spec is missing for a product, say "Not specified" rather than guessing.',
    messages: [{ role: 'user', content: JSON.stringify(catalogData) }],
    tools: [COMPARISON_TOOL],
    tool_choice: { type: 'tool', name: 'build_comparison' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const comparison = toolUse?.input || {};

  return { products: catalogData, ...comparison, aiGenerated: true };
}
