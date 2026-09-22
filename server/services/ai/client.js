import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import logger from '../../utils/logger.js';

// Pinned, currently-confirmed free-tier models (verified against
// ai.google.dev/gemini-api/docs/models and /pricing, and by live-testing
// each candidate directly) — deliberately NOT a "-latest" alias, so this app
// can never silently start resolving to a paid model if Google repoints an
// alias later. Override via env if needed, but know what you're pinning to.
//
// CHAT_MODEL is gemini-3.6-flash, not the newer gemini-3.8-flash: live
// testing during this integration hit a real, repeatable 503 "this model is
// currently experiencing high demand" on 3.8-flash, while 3.6-flash (also
// free-tier, and Google's own currently-recommended general-purpose Flash
// model per its API error messages for deprecated models) responded
// reliably. Revisit if that capacity issue turns out to be long-lived.
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite';
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.6-flash';

const REQUEST_TIMEOUT_MS = 25_000;

let client = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export function isAIAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// --- Anthropic-shaped <-> Gemini-shaped translation ---
//
// All seven AI feature services (assistantService, searchFilterService,
// comparisonService, descriptionGeneratorService, reviewSummaryService,
// bundleService, insightsService) were originally built against Anthropic's
// Messages API tool-use shape: {model, max_tokens, system, messages, tools,
// tool_choice} in, {content: [{type:'text'|'tool_use', ...}], usage} out.
// Rather than rewrite all seven (and their tool-use loops) for Gemini's very
// different function-calling shape, this module — the one seam every AI
// feature already routed through — translates transparently at the
// boundary. createMessage()'s public contract is unchanged; only what's
// behind it moved from Anthropic to Gemini.

function toGeminiTools(tools) {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        // Gemini accepts a plain JSON Schema here (not a special Type-enum
        // object) — the existing Anthropic `input_schema` objects (already
        // plain JSON Schema) pass through unchanged.
        parametersJsonSchema: t.input_schema,
      })),
    },
  ];
}

function toGeminiToolConfig(toolChoice) {
  if (toolChoice?.type === 'tool' && toolChoice.name) {
    return { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [toolChoice.name] } };
  }
  return { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } };
}

// Converts an Anthropic-shaped `messages` array — including raw assistant
// turns this module previously returned via `content`, and the tool_result
// blocks built from them — into Gemini's Content[].
function toGeminiContents(messages) {
  // Anthropic's tool_result blocks carry only tool_use_id, not the tool
  // name, but Gemini's functionResponse needs both — recover the mapping
  // from the matching tool_use block earlier in the same conversation.
  const idToName = new Map();
  for (const message of messages) {
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') idToName.set(block.id, block.name);
      }
    }
  }

  return messages.map((message) => {
    const role = message.role === 'assistant' ? 'model' : 'user';

    if (typeof message.content === 'string') {
      return { role, parts: [{ text: message.content }] };
    }

    const parts = (message.content || []).map((block) => {
      if (block.type === 'text') return { text: block.text };
      if (block.type === 'tool_use') {
        const part = { functionCall: { id: block.id, name: block.name, args: block.input || {} } };
        // Gemini 3.x requires the original thoughtSignature to be echoed
        // back on a functionCall part in the next turn — confirmed by a
        // real 400 ("Function call is missing a thought_signature... This
        // is required for tools to work correctly") when omitted. Anthropic
        // tool_use blocks have no such concept, so it's carried as an extra
        // pass-through field on our own intermediate shape (see
        // fromGeminiResponse) rather than a real Anthropic field.
        if (block.thoughtSignature) part.thoughtSignature = block.thoughtSignature;
        return part;
      }
      if (block.type === 'tool_result') {
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(block.content);
        } catch {
          parsedResponse = block.content;
        }
        return {
          functionResponse: {
            id: block.tool_use_id,
            name: idToName.get(block.tool_use_id) || 'unknown_tool',
            // Gemini's FunctionResponse.response must be a JSON *object*
            // (map), never an array or primitive — confirmed by a real 400
            // ("Proto field is not repeating, cannot start list") when a
            // tool that returns an array (e.g. search_products) was passed
            // straight through. Google's own documented convention for any
            // output shape is to wrap it under an "output" key, applied
            // uniformly here regardless of what the tool actually returned.
            response: { output: parsedResponse },
          },
        };
      }
      return { text: '' };
    });

    return { role, parts };
  });
}

let fallbackIdCounter = 0;
function nextFallbackToolUseId() {
  fallbackIdCounter += 1;
  return `call_${Date.now()}_${fallbackIdCounter}`;
}

// Gemini's FunctionCall.id is only populated in some configurations — when
// absent, synthesize one. It only needs to be unique and consistent within
// a single conversation (the caller echoes it straight back in the matching
// tool_result), which a monotonic counter satisfies.
function fromGeminiResponse(response) {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const content = parts.map((part) => {
    if (part.functionCall) {
      const block = {
        type: 'tool_use',
        id: part.functionCall.id || nextFallbackToolUseId(),
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      };
      // Carried through opaquely so a later turn can echo it back — see
      // toGeminiContents's tool_use handling.
      if (part.thoughtSignature) block.thoughtSignature = part.thoughtSignature;
      return block;
    }
    return { type: 'text', text: part.text || '' };
  });
  return { content, usage: response.usageMetadata };
}

// Every AI feature routes its Gemini calls through here so usage logging,
// error wrapping, and the "no key configured" fallback are handled in one
// place.
export async function createMessage(params) {
  const ai = getClient();
  if (!ai) {
    const err = new Error('AI service is not configured (missing GEMINI_API_KEY).');
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }

  try {
    const response = await ai.models.generateContent({
      model: params.model,
      contents: toGeminiContents(params.messages),
      config: {
        systemInstruction: params.system,
        maxOutputTokens: params.max_tokens,
        tools: toGeminiTools(params.tools),
        toolConfig: params.tools?.length ? toGeminiToolConfig(params.tool_choice) : undefined,
        // Observed in testing: non-Lite Gemini 3.x Flash models spend part
        // of maxOutputTokens on invisible "thinking" tokens by default,
        // which on the short max_tokens budgets every AI feature here uses
        // (100-800, sized for brief structured/conversational replies, not
        // deep reasoning) can exhaust the whole budget before any visible
        // text/tool-call is emitted — finishReason: 'MAX_TOKENS' with empty
        // content. None of this app's tasks need multi-step reasoning, so
        // thinking is disabled outright rather than just budgeted larger.
        // Also confirmed by testing: Lite models (e.g. FAST_MODEL) don't
        // have this behavior AND reject thinkingConfig outright with a 400
        // ("Request contains an invalid argument") — Google's own model-id
        // convention marks Lite variants in the name itself, which this
        // check relies on rather than hardcoding the exact pinned names.
        ...(/lite/i.test(params.model) ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        // Observed in testing: under free-tier rate limiting, a request can
        // take 30+ seconds before the SDK's own retry/backoff gives up and
        // either succeeds or surfaces an error — with no bound, that leaves
        // the HTTP request (and the connection holding it open) hanging
        // indefinitely from the caller's side. Fail clearly instead.
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const result = fromGeminiResponse(response);
    logger.info('ai_request', {
      model: params.model,
      inputTokens: result.usage?.promptTokenCount,
      outputTokens: result.usage?.candidatesTokenCount,
    });
    return result;
  } catch (error) {
    // 429 = quota/rate-limit exceeded — the free tier's most common failure
    // mode. A timed-out/aborted request (see REQUEST_TIMEOUT_MS above) is
    // observed in practice to be the *same* underlying cause — the free
    // tier queuing/backing off a request for 25s+ before ever responding —
    // just surfaced differently by the SDK (an AbortError with no HTTP
    // status), so both get the same honest, specific message.
    const isQuotaOrTimeout = error.status === 429 || error.name === 'AbortError';
    logger.error('ai_request_failed', { model: params.model, status: error.status, name: error.name, error: error.message });
    const wrapped = new Error(
      isQuotaOrTimeout
        ? 'The AI service has hit its free-tier rate/quota limit. Please try again in a moment.'
        : 'AI service is temporarily unavailable. Please try again shortly.'
    );
    wrapped.code = 'AI_REQUEST_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
}
