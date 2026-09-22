import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAIAvailable } from '../services/ai/client.js';
import { semanticProductSearch } from '../services/ai/searchFilterService.js';
import { runAssistant } from '../services/ai/assistantService.js';

describe('AI graceful degradation when GEMINI_API_KEY is not configured', () => {
  const original = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (original) process.env.GEMINI_API_KEY = original;
  });

  it('reports AI as unavailable', () => {
    expect(isAIAvailable()).toBe(false);
  });

  it('semantic search throws a typed AI_UNAVAILABLE error instead of hanging or crashing', async () => {
    await expect(semanticProductSearch('cheap shoes')).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('the assistant throws a typed AI_UNAVAILABLE error instead of fabricating a reply', async () => {
    await expect(runAssistant({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
  });
});
