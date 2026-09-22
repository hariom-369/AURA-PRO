import Product from '../../models/Product.js';
import { createMessage, CHAT_MODEL, isAIAvailable } from './client.js';

const DESCRIPTION_TOOL = {
  name: 'generate_product_copy',
  description: 'Generate SEO-friendly marketing copy and categorization suggestions for a product from its real attributes only.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'Engaging, accurate product description (2-4 short paragraphs). Must not mention price, discounts, or stock levels — those change independently of copy.',
      },
      seoTitle: { type: 'string', description: 'SEO title, under 60 characters.' },
      seoDescription: { type: 'string', description: 'SEO meta description, under 160 characters.' },
      suggestedTags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 6 short, lowercase search/browse tags grounded in the product\'s real attributes (e.g. "wireless", "noise-cancelling").',
      },
      suggestedCategory: {
        type: 'string',
        description: 'Best-fit category for this product. Prefer an exact match from the known categories list if one fits; otherwise propose a short, sensible new one.',
      },
    },
    required: ['description', 'seoTitle', 'seoDescription', 'suggestedTags', 'suggestedCategory'],
  },
};

let categoryCache = null;
let categoryCacheAt = 0;
async function getKnownCategories() {
  if (categoryCache && Date.now() - categoryCacheAt < 60_000) return categoryCache;
  categoryCache = await Product.distinct('category');
  categoryCacheAt = Date.now();
  return categoryCache;
}

// Admin-only. Writes to draft* fields only — never overwrites the live,
// customer-facing description/category/tags until an admin explicitly approves it.
export async function generateProductDraft(productId) {
  if (!isAIAvailable()) {
    const err = new Error('AI description generator is not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  const product = await Product.findById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const knownCategories = await getKnownCategories();

  const facts = {
    name: product.name,
    brand: product.brand,
    category: product.category,
    specifications: product.specifications,
    tags: product.tags,
    existingDescription: product.description,
    knownCategories,
  };

  const response = await createMessage({
    model: CHAT_MODEL,
    max_tokens: 600,
    system:
      'You write accurate, attractive e-commerce product copy and categorization suggestions strictly from the given facts. Never invent a specification, material, or claim not present in the data. Never mention a specific price or discount percentage.',
    messages: [{ role: 'user', content: JSON.stringify(facts) }],
    tools: [DESCRIPTION_TOOL],
    tool_choice: { type: 'tool', name: 'generate_product_copy' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const draft = toolUse?.input || {};

  product.draftDescription = draft.description || null;
  product.draftSeoTitle = draft.seoTitle || null;
  product.draftSeoDescription = draft.seoDescription || null;
  product.draftTags = Array.isArray(draft.suggestedTags) ? draft.suggestedTags : [];
  product.draftCategory = draft.suggestedCategory || null;
  await product.save();

  return {
    productId: product._id,
    draftDescription: product.draftDescription,
    draftSeoTitle: product.draftSeoTitle,
    draftSeoDescription: product.draftSeoDescription,
    draftTags: product.draftTags,
    draftCategory: product.draftCategory,
  };
}

export async function approveProductDraft(productId) {
  const product = await Product.findById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  if (!product.draftDescription) {
    const err = new Error('No draft description to approve — generate one first');
    err.statusCode = 400;
    throw err;
  }

  product.description = product.draftDescription;
  if (product.draftSeoTitle) product.seoTitle = product.draftSeoTitle;
  if (product.draftSeoDescription) product.seoDescription = product.draftSeoDescription;
  if (product.draftTags?.length) product.tags = product.draftTags;
  if (product.draftCategory) product.category = product.draftCategory;

  product.draftDescription = null;
  product.draftSeoTitle = null;
  product.draftSeoDescription = null;
  product.draftTags = [];
  product.draftCategory = null;
  await product.save();

  return product.toObject();
}
