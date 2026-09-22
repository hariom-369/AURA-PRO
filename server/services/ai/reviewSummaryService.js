import Review from '../../models/Review.js';
import { createMessage, FAST_MODEL, isAIAvailable } from './client.js';

const MIN_REVIEWS_FOR_SUMMARY = 3;

const SUMMARY_TOOL = {
  name: 'summarize_reviews',
  description: 'Summarize genuine customer reviews for a product, using only the given review text.',
  input_schema: {
    type: 'object',
    properties: {
      overallSentiment: { type: 'string', enum: ['positive', 'mixed', 'negative'] },
      commonPros: { type: 'array', items: { type: 'string' } },
      commonCons: { type: 'array', items: { type: 'string' } },
      recurringComplaints: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string', description: 'A short 2-3 sentence natural-language summary.' },
    },
    required: ['overallSentiment', 'commonPros', 'commonCons', 'recurringComplaints', 'summary'],
  },
};

// Refuses to summarize below a minimum review count, and states the count it
// used — so the UI can never present a "summary" that's really one opinion.
export async function summarizeProductReviews(productId) {
  const reviews = await Review.find({ product: productId })
    .select('rating title comment isVerifiedPurchase')
    .lean();

  if (reviews.length < MIN_REVIEWS_FOR_SUMMARY) {
    return {
      reviewCount: reviews.length,
      summary: null,
      message: `Not enough reviews yet to summarize (minimum ${MIN_REVIEWS_FOR_SUMMARY}).`,
    };
  }

  if (!isAIAvailable()) {
    return { reviewCount: reviews.length, summary: null, message: 'AI review summarization is not configured.' };
  }

  const reviewText = reviews
    .map(
      (r) =>
        `Rating: ${r.rating}/5${r.isVerifiedPurchase ? ' (verified purchase)' : ''}\n${r.title ? r.title + '\n' : ''}${r.comment}`
    )
    .join('\n---\n');

  const response = await createMessage({
    model: FAST_MODEL,
    max_tokens: 500,
    system:
      'You summarize genuine customer reviews strictly from the text given. Never invent a pro, con, or complaint not expressed in the reviews. If reviews conflict, reflect that with "mixed" sentiment.',
    messages: [{ role: 'user', content: reviewText }],
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'summarize_reviews' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const summary = toolUse?.input || null;

  return { reviewCount: reviews.length, summary, message: null };
}
