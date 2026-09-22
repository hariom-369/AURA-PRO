import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks the SDK boundary only — everything above it (the translation layer
// in services/ai/client.js) runs for real, so these tests actually exercise
// the Anthropic-shape <-> Gemini-shape conversion without ever calling
// Google's API.
const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  // A plain function (not an arrow function) so `new GoogleGenAI(...)` in the
  // real client code works against this mock.
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  }),
  FunctionCallingConfigMode: { MODE_UNSPECIFIED: 'MODE_UNSPECIFIED', AUTO: 'AUTO', ANY: 'ANY', NONE: 'NONE', VALIDATED: 'VALIDATED' },
}));

const ORIGINAL_ENV = { ...process.env };

async function freshClient(envOverrides = {}) {
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: 'test-key', ...envOverrides };
  vi.resetModules();
  return import('../services/ai/client.js');
}

beforeEach(() => {
  generateContentMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Gemini AI client — availability', () => {
  it('reports unavailable and never touches the SDK when GEMINI_API_KEY is unset', async () => {
    const { isAIAvailable, createMessage } = await freshClient({ GEMINI_API_KEY: '' });

    expect(isAIAvailable()).toBe(false);
    await expect(createMessage({ model: 'x', messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('reports available once GEMINI_API_KEY is set', async () => {
    const { isAIAvailable } = await freshClient();
    expect(isAIAvailable()).toBe(true);
  });
});

describe('Gemini AI client — request/response shape translation', () => {
  it('sends system/max_tokens/messages in Gemini shape and returns a plain-text reply as an Anthropic-shaped text block', async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'Hello there' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    const { createMessage } = await freshClient();

    const result = await createMessage({ model: 'gemini-x', max_tokens: 100, system: 'sys prompt', messages: [{ role: 'user', content: 'hi' }] });

    expect(result.content).toEqual([{ type: 'text', text: 'Hello there' }]);
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-x',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        config: expect.objectContaining({ systemInstruction: 'sys prompt', maxOutputTokens: 100 }),
      })
    );
  });

  it('forces a single tool call via ANY mode + allowedFunctionNames, and translates the functionCall back to a tool_use block', async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ functionCall: { id: 'call_1', name: 'extract_filters', args: { keywords: 'shoes' } } }] } }],
      usageMetadata: {},
    });
    const { createMessage } = await freshClient();

    const result = await createMessage({
      model: 'gemini-x',
      messages: [{ role: 'user', content: 'cheap shoes' }],
      tools: [{ name: 'extract_filters', description: 'd', input_schema: { type: 'object', properties: {} } }],
      tool_choice: { type: 'tool', name: 'extract_filters' },
    });

    expect(result.content).toEqual([{ type: 'tool_use', id: 'call_1', name: 'extract_filters', input: { keywords: 'shoes' } }]);
    const callArgs = generateContentMock.mock.calls[0][0];
    expect(callArgs.config.tools).toEqual([
      { functionDeclarations: [{ name: 'extract_filters', description: 'd', parametersJsonSchema: { type: 'object', properties: {} } }] },
    ]);
    expect(callArgs.config.toolConfig).toEqual({ functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['extract_filters'] } });
  });

  it('uses AUTO mode when multiple tools are offered without a forced choice (the assistant loop pattern)', async () => {
    generateContentMock.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: {} });
    const { createMessage } = await freshClient();

    await createMessage({
      model: 'gemini-x',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        { name: 'search_products', description: 'd', input_schema: { type: 'object' } },
        { name: 'get_product_details', description: 'd', input_schema: { type: 'object' } },
      ],
    });

    expect(generateContentMock.mock.calls[0][0].config.toolConfig).toEqual({ functionCallingConfig: { mode: 'AUTO' } });
  });

  it('disables thinking for non-Lite models (avoids an empty MAX_TOKENS response) but omits it for Lite models (which reject the field with a 400)', async () => {
    generateContentMock.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: {} });
    const { createMessage } = await freshClient();

    await createMessage({ model: 'gemini-3.6-flash', messages: [{ role: 'user', content: 'hi' }] });
    expect(generateContentMock.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });

    await createMessage({ model: 'gemini-3.5-flash-lite', messages: [{ role: 'user', content: 'hi' }] });
    expect(generateContentMock.mock.calls[1][0].config.thinkingConfig).toBeUndefined();
  });

  it('carries thoughtSignature through opaquely and echoes it back on the functionCall in the next turn', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ functionCall: { name: 'search_products', args: { keywords: 'x' } }, thoughtSignature: 'sig-abc' }] } }],
      usageMetadata: {},
    });
    const { createMessage } = await freshClient();
    const tools = [{ name: 'search_products', description: 'd', input_schema: { type: 'object' } }];

    const first = await createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'find x' }], tools });
    expect(first.content[0].thoughtSignature).toBe('sig-abc');

    generateContentMock.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: {} });
    const conversation = [
      { role: 'user', content: 'find x' },
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: first.content[0].id, content: '[]' }] },
    ];
    await createMessage({ model: 'gemini-x', messages: conversation, tools });

    const secondCallArgs = generateContentMock.mock.calls[1][0];
    const assistantContent = secondCallArgs.contents.find((c) => c.role === 'model');
    // Gemini requires this echoed back on the part in the next turn — a real
    // 400 ("Function call is missing a thought_signature...") confirmed it
    // during live testing when this was dropped.
    expect(assistantContent.parts[0].thoughtSignature).toBe('sig-abc');
  });

  it('synthesizes a tool_use id when Gemini omits one, and round-trips a tool_result back as a matching functionResponse', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ functionCall: { name: 'search_products', args: { keywords: 'x' } } }] } }],
      usageMetadata: {},
    });
    const { createMessage } = await freshClient();
    const tools = [{ name: 'search_products', description: 'd', input_schema: { type: 'object' } }];

    const first = await createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'find x' }], tools });
    const toolUseBlock = first.content[0];
    expect(toolUseBlock.type).toBe('tool_use');
    expect(toolUseBlock.id).toBeTruthy();

    generateContentMock.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Found it!' }] } }], usageMetadata: {} });

    const conversation = [
      { role: 'user', content: 'find x' },
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify([{ name: 'Product X' }]) }] },
    ];
    await createMessage({ model: 'gemini-x', messages: conversation, tools });

    const secondCallArgs = generateContentMock.mock.calls[1][0];
    const lastContent = secondCallArgs.contents[secondCallArgs.contents.length - 1];
    expect(lastContent.role).toBe('user');
    expect(lastContent.parts[0].functionResponse).toEqual({
      id: toolUseBlock.id,
      name: 'search_products', // recovered from the earlier tool_use block, not present on the tool_result itself
      // Wrapped under "output" — Gemini rejects a bare array/primitive here
      // (confirmed by a real 400 during live testing); see client.js.
      response: { output: [{ name: 'Product X' }] },
    });
  });

  it('wraps a tool result that is a plain object the same way, for consistency (never conditionally shaped)', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ functionCall: { name: 'get_order_status', args: { orderNumber: 'AURA-1' } } }] } }],
      usageMetadata: {},
    });
    const { createMessage } = await freshClient();
    const tools = [{ name: 'get_order_status', description: 'd', input_schema: { type: 'object' } }];

    const first = await createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'where is my order' }], tools });
    const toolUseBlock = first.content[0];

    generateContentMock.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Shipped!' }] } }], usageMetadata: {} });
    const conversation = [
      { role: 'user', content: 'where is my order' },
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify({ status: 'SHIPPED' }) }] },
    ];
    await createMessage({ model: 'gemini-x', messages: conversation, tools });

    const lastContent = generateContentMock.mock.calls[1][0].contents.at(-1);
    expect(lastContent.parts[0].functionResponse.response).toEqual({ output: { status: 'SHIPPED' } });
  });
});

describe('Gemini AI client — error handling', () => {
  it('wraps a 429 quota/rate-limit error with a distinct, honest message (never silently retries against a paid tier)', async () => {
    const quotaError = new Error('Resource exhausted');
    quotaError.status = 429;
    generateContentMock.mockRejectedValue(quotaError);
    const { createMessage } = await freshClient();

    await expect(createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({
      code: 'AI_REQUEST_FAILED',
    });
    generateContentMock.mockRejectedValue(quotaError);
    await expect(createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/rate|quota/i);
  });

  it('treats a timed-out/aborted request (observed in practice under free-tier load) the same as a quota error, not a generic outage', async () => {
    const abortError = new Error('This operation was aborted');
    abortError.name = 'AbortError';
    generateContentMock.mockRejectedValue(abortError);
    const { createMessage } = await freshClient();

    await expect(createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/rate|quota/i);
  });

  it('wraps a generic SDK/network failure with the standard unavailable message, never leaking the raw error', async () => {
    generateContentMock.mockRejectedValue(new Error('ECONNRESET'));
    const { createMessage } = await freshClient();

    await expect(createMessage({ model: 'gemini-x', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/temporarily unavailable/i);
  });
});
