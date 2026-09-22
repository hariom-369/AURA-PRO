import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { isAIAvailable } from '../services/ai/client.js';
import { semanticProductSearch } from '../services/ai/searchFilterService.js';
import { runAssistant } from '../services/ai/assistantService.js';
import { compareProducts } from '../services/ai/comparisonService.js';
import { getSimilarProducts, getPersonalizedRecommendations } from '../services/ai/recommendationService.js';
import { generateProductDraft, approveProductDraft } from '../services/ai/descriptionGeneratorService.js';
import { summarizeProductReviews } from '../services/ai/reviewSummaryService.js';
import { getFrequentlyBoughtWith } from '../services/ai/bundleService.js';
import { generateBusinessInsights } from '../services/ai/insightsService.js';
import { computeAnalyticsOverview } from './analyticsController.js';

function rethrowAsServiceUnavailable(error) {
  if (error.code === 'AI_UNAVAILABLE' || error.code === 'AI_REQUEST_FAILED') {
    throw new ApiError(503, 'The AI service is temporarily unavailable. Please try again shortly.');
  }
  if (error.statusCode) {
    throw new ApiError(error.statusCode, error.message);
  }
  throw error;
}

// @desc    Report whether the AI service is configured and reachable
// @route   GET /api/v1/ai/health
export const aiHealth = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, { available: isAIAvailable() }, 'AI service status'));
});

// @desc    Natural-language product search, grounded in the real catalog
// @route   POST /api/v1/ai/search
export const aiSearch = asyncHandler(async (req, res) => {
  const { query, page, limit } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ApiError(400, 'A search query is required');
  }
  if (query.length > 300) {
    throw new ApiError(400, 'Search query is too long (max 300 characters)');
  }

  try {
    const result = await semanticProductSearch(query.trim(), {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(Math.max(1, Number(limit) || 12), 24),
    });
    res.status(200).json(new ApiResponse(200, result, 'Semantic search results'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Conversational shopping assistant (tool-use grounded in DB data)
// @route   POST /api/v1/ai/chat
export const aiChat = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ApiError(400, 'A non-empty messages array is required');
  }
  if (messages.length > 30) {
    throw new ApiError(400, 'Conversation is too long — please start a new chat');
  }
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      throw new ApiError(400, 'Invalid message format');
    }
    if (message.content.length > 2000) {
      throw new ApiError(400, 'Message is too long (max 2000 characters)');
    }
  }

  try {
    const result = await runAssistant({ messages, userId: req.user?._id?.toString() });
    res.status(200).json(new ApiResponse(200, result, 'Assistant reply'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Compare 2-4 products, grounded strictly in real catalog data
// @route   POST /api/v1/ai/compare
export const aiCompare = asyncHandler(async (req, res) => {
  const { productIds } = req.body;
  if (!Array.isArray(productIds) || productIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new ApiError(400, 'productIds must be an array of valid product IDs');
  }
  try {
    const result = await compareProducts(productIds);
    res.status(200).json(new ApiResponse(200, result, 'Product comparison'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Content-based "similar products" for a given product
// @route   GET /api/v1/ai/products/:id/similar
export const aiSimilarProducts = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product ID');
  }
  try {
    const result = await getSimilarProducts(req.params.id, { limit: Math.min(Number(req.query.limit) || 6, 12) });
    res.status(200).json(new ApiResponse(200, result, 'Similar products'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Personalized recommendations from recently-viewed/cart signal
// @route   POST /api/v1/ai/recommendations
export const aiRecommendations = asyncHandler(async (req, res) => {
  const { recentlyViewedIds = [], cartProductIds = [], limit } = req.body;
  const isIdArray = (arr) => Array.isArray(arr) && arr.every((id) => mongoose.isValidObjectId(id));
  if (!isIdArray(recentlyViewedIds) || !isIdArray(cartProductIds)) {
    throw new ApiError(400, 'recentlyViewedIds and cartProductIds must be arrays of valid product IDs');
  }
  const result = await getPersonalizedRecommendations({
    recentlyViewedIds,
    cartProductIds,
    limit: Math.min(Number(limit) || 8, 16),
  });
  res.status(200).json(new ApiResponse(200, result, 'Personalized recommendations'));
});

// @desc    "Frequently bought together" bundle for a product
// @route   GET /api/v1/ai/products/:id/bundle
export const aiBundle = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product ID');
  }
  try {
    const result = await getFrequentlyBoughtWith(req.params.id, { limit: Math.min(Number(req.query.limit) || 4, 8) });
    res.status(200).json(new ApiResponse(200, result, 'Frequently bought together'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    AI summary of a product's genuine customer reviews
// @route   GET /api/v1/ai/products/:id/review-summary
export const aiReviewSummary = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product ID');
  }
  const result = await summarizeProductReviews(req.params.id);
  res.status(200).json(new ApiResponse(200, result, 'Review summary'));
});

// @desc    Admin: generate a draft AI description/SEO copy for a product (not published)
// @route   POST /api/v1/ai/admin/products/:id/generate-description
export const aiGenerateDescription = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product ID');
  }
  try {
    const result = await generateProductDraft(req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Draft description generated — review before publishing'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Admin: publish a previously generated draft description
// @route   POST /api/v1/ai/admin/products/:id/approve-description
export const aiApproveDescription = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid product ID');
  }
  try {
    const product = await approveProductDraft(req.params.id);
    res.status(200).json(new ApiResponse(200, product, 'Draft description published'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});

// @desc    Admin: AI-narrated summary of real sales/inventory metrics (clearly
//          an estimate — never a directive; grounded strictly in computed data)
// @route   GET /api/v1/ai/admin/insights
export const aiBusinessInsights = asyncHandler(async (req, res) => {
  try {
    const metrics = await computeAnalyticsOverview();
    const insights = await generateBusinessInsights(metrics);
    res.status(200).json(new ApiResponse(200, { insights, isEstimate: true }, 'AI-generated business insights (estimate)'));
  } catch (error) {
    rethrowAsServiceUnavailable(error);
  }
});
