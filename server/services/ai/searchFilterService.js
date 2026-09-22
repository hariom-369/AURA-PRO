import Product from '../../models/Product.js';
import { createMessage, FAST_MODEL, isAIAvailable } from './client.js';
import { buildProductQuery } from '../../utils/productQuery.js';

const FILTER_TOOL = {
  name: 'extract_search_filters',
  description: 'Extract structured product search filters from a natural language shopping query.',
  input_schema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description: 'Core search keywords to match against product name/description/brand. Empty string if none.',
      },
      category: {
        type: 'string',
        description: 'Exact match from the known categories list, or empty string if unclear or not mentioned.',
      },
      brand: {
        type: 'string',
        description: 'Exact match from the known brands list, or empty string if unclear or not mentioned.',
      },
      minPrice: { type: 'number', description: 'Minimum price in INR (rupees). Omit if not specified.' },
      maxPrice: { type: 'number', description: 'Maximum price in INR (rupees). Omit if not specified.' },
      minRating: { type: 'number', description: 'Minimum star rating 0-5. Omit if not specified.' },
      sortBy: {
        type: 'string',
        enum: ['relevance', 'price-low', 'price-high', 'newest', 'rating'],
        description: 'Best sort order implied by the query.',
      },
    },
    required: ['keywords', 'sortBy'],
  },
};

let catalogCache = null;
let catalogCacheAt = 0;
const CATALOG_CACHE_MS = 60_000;

async function getKnownCategoriesAndBrands() {
  if (catalogCache && Date.now() - catalogCacheAt < CATALOG_CACHE_MS) {
    return catalogCache;
  }
  const [categories, brands] = await Promise.all([
    Product.distinct('category'),
    Product.distinct('brand'),
  ]);
  catalogCache = { categories, brands };
  catalogCacheAt = Date.now();
  return catalogCache;
}

// Natural-language query -> Gemini extracts structured filters -> plain MongoDB
// query. This keeps semantic search grounded in real catalog data (no vector
// infra required, and Gemini never sees or returns product data itself here).
export async function semanticProductSearch(naturalLanguageQuery, { page = 1, limit = 12 } = {}) {
  if (!isAIAvailable()) {
    const err = new Error('AI search is not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  const { categories, brands } = await getKnownCategoriesAndBrands();

  const response = await createMessage({
    model: FAST_MODEL,
    max_tokens: 400,
    system: `You extract structured product search filters from natural-language shopping queries for an e-commerce catalog.
Known categories: ${categories.join(', ') || 'none'}.
Known brands: ${brands.join(', ') || 'none'}.
Only set category/brand to a value from these exact lists — leave them empty if the query doesn't clearly match one. Never invent a category or brand that isn't listed. Prices are in Indian Rupees (INR).`,
    messages: [{ role: 'user', content: naturalLanguageQuery }],
    tools: [FILTER_TOOL],
    tool_choice: { type: 'tool', name: 'extract_search_filters' },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  const filters = toolUse?.input || {};

  const { query, sort } = buildProductQuery({
    search: filters.keywords,
    category: filters.category,
    brand: filters.brand,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    sort: filters.sortBy === 'relevance' ? undefined : filters.sortBy,
  });

  query.isActive = true;

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
  ]);

  return {
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    interpretedFilters: filters,
  };
}
