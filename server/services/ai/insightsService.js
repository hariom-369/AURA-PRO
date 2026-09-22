import { createMessage, FAST_MODEL, isAIAvailable } from './client.js';

const INSIGHTS_TOOL = {
  name: 'summarize_business_insights',
  description: 'Write a short, plain-language summary of store performance strictly from the given metrics.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One sentence overall takeaway.' },
      observations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 4 short, specific observations grounded only in the numbers given (e.g. trends, standouts, risks like low stock).',
      },
      suggestedActions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 concrete, low-risk suggestions (e.g. restock a specific low-stock item, promote a top seller). Never suggest pricing, refund, or account changes.',
      },
    },
    required: ['headline', 'observations', 'suggestedActions'],
  },
};

// Admin-only. The model never sees raw customer PII — only aggregated,
// already-computed metrics — and every output is labeled an estimate by the
// caller (never treated as a directive).
export async function generateBusinessInsights(metrics) {
  if (!isAIAvailable()) {
    const err = new Error('AI insights are not configured');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  const response = await createMessage({
    model: FAST_MODEL,
    max_tokens: 500,
    system:
      'You are a retail analytics assistant. Summarize the given store metrics strictly from the numbers provided. Never invent a figure, trend, or comparison not present in the data. If the data is too sparse to say something meaningful (e.g. very few orders), say so plainly instead of overreaching.',
    messages: [{ role: 'user', content: JSON.stringify(metrics) }],
    tools: [INSIGHTS_TOOL],
    tool_choice: { type: 'tool', name: 'summarize_business_insights' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  return toolUse?.input || null;
}
