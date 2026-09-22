# AI (Google Gemini)

AURA PRO's AI features — the shopping/support assistant, semantic search, product comparison, personalized recommendations, "frequently bought together" labels, review summarization, the admin description generator, and admin business insights — are all powered by **Google Gemini** via the official `@google/genai` SDK.

## Models

| Constant | Env var | Default | Used by |
| --- | --- | --- | --- |
| `CHAT_MODEL` | `GEMINI_CHAT_MODEL` | `gemini-3.6-flash` | The shopping/support assistant (`/ai/chat`) — the only feature needing multi-turn conversation + several possible tools |
| `FAST_MODEL` | `GEMINI_FAST_MODEL` | `gemini-3.5-flash-lite` | Everything else: search filter extraction, comparison, description drafts, review summaries, bundle labels, business insights — all single-turn, short-context, structured-output tasks |

Both are **pinned to specific model names, not a `-latest` alias**, and were verified against `ai.google.dev/gemini-api/docs/models` and `/pricing`, and by live-testing each candidate directly, to be reliably on the free tier at integration time. This is deliberate: an alias could later be repointed by Google to a paid-only model without this app's knowledge, silently changing your bill. If you want to change models, edit the env vars (or the defaults in `server/services/ai/client.js`) explicitly — never let this resolve automatically.

`CHAT_MODEL` is deliberately `gemini-3.6-flash`, not the newer `gemini-3.8-flash` — live-testing during this integration hit a real, repeatable `503 "this model is currently experiencing high demand"` on 3.8-flash, while 3.6-flash (also free-tier, and Google's own currently-recommended general-purpose Flash model — its API error message for the now-deprecated `gemini-2.5-flash` explicitly names 3.6-flash as the replacement) responded reliably every time. If Google's capacity issue on 3.8-flash turns out to be long-resolved by the time you read this, that's a one-line env var change, not a code change.

**Free tier is Flash-only** — Pro models require billing. Rate limits (subject to change; check `aistudio.google.com/rate-limit` for your account's actual current values) are roughly 15 RPM / ~1,500 RPD for Flash, and double the RPM for Flash-Lite — one reason the higher-volume, cheaper tasks above use the Lite model.

## Getting an API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in, create a key.
2. Set it as `GEMINI_API_KEY` in `server/.env`. Nothing else is required — the free tier needs no billing setup, but each subsequent minor/major model deprecation may require revisiting the pinned model names above.
3. **Never** put this key in `client/.env`, commit it, or log it — see [Security](#security) below.

## Architecture: the Anthropic-shape compatibility layer

This app's seven AI feature services (`server/services/ai/*Service.js`) were originally written against Anthropic's Messages API tool-use shape. Rather than rewrite each one for Gemini's different function-calling API, **`server/services/ai/client.js` translates transparently at the one seam every feature already routed through**:

- `createMessage({model, max_tokens, system, messages, tools, tool_choice})` — the public contract every service calls — is unchanged.
- Internally, `client.js` converts that into a real `ai.models.generateContent()` call (Gemini's `functionDeclarations`/`toolConfig`/`systemInstruction`/`maxOutputTokens`), and converts Gemini's response (`candidates[0].content.parts`, a mix of `text` and `functionCall` parts) back into the same `{content: [{type:'text'|'tool_use', ...}], usage}` shape Anthropic used to return.
- A forced single-tool call (`tool_choice: {type:'tool', name}` — used by search/comparison/description/review-summary/bundle/insights, all "always call exactly this one tool" patterns) maps to Gemini's `functionCallingConfig: {mode: 'ANY', allowedFunctionNames: [name]}`.
- The multi-turn, model-chooses-the-tool pattern (used only by the shopping assistant, `assistantService.js`) maps to `mode: 'AUTO'`.
- Gemini's `FunctionCall.id` isn't always populated; when absent, `client.js` synthesizes one so the existing tool-result round-trip logic in `assistantService.js` (which was written assuming Anthropic always provides one) keeps working unmodified.

**No other AI service file changed.** This kept the swap to one file's internals plus a handful of one-word comment updates, and means the anti-hallucination design (the model must call a real, server-executed, DB-backed tool for any product/price/stock/order fact — see the system prompts in each service) is completely unaffected by the provider swap.

## Error handling

- **Not configured** (`GEMINI_API_KEY` unset) → every feature throws a typed `AI_UNAVAILABLE` error → the controller returns a clean `503` (`aiController.js`'s `rethrowAsServiceUnavailable`). The rest of the app is unaffected — this is the same graceful-degradation contract that existed before the provider swap.
- **Quota/rate-limit exceeded** (HTTP 429 from Gemini — the free tier's most common failure mode) → `client.js` catches this specifically and throws a message that says so explicitly ("hit its free-tier rate/quota limit"), rather than a generic outage message, so you can tell the two apart in logs and in the API response.
- **Request timeout (25s)** — observed directly while testing this integration: under free-tier load, a request can take 30+ seconds before the SDK's own internal retry/backoff either succeeds or gives up, and with no bound that left an HTTP request (and the connection holding it) hanging indefinitely from the caller's side. `client.js` sets `httpOptions.timeout: 25000` on every call, so a slow request fails cleanly instead of hanging; a resulting `AbortError` is treated the same as a 429 (same underlying cause, just surfaced differently by the SDK) — same "rate/quota limit, try again shortly" message, not a generic outage.
- **Thinking tokens are disabled for non-Lite models only** (`thinkingConfig: {thinkingBudget: 0}`) — also found by direct testing: non-Lite Gemini 3.x Flash models (`CHAT_MODEL`) spend part of `max_tokens` on invisible reasoning by default, which on this app's short response budgets (100-800 tokens, sized for brief replies, not deep reasoning) can exhaust the whole budget before any visible text/tool-call is emitted, returning `finishReason: 'MAX_TOKENS'` with **empty content** — a real bug that looks like silent failure, not an error. Lite models (`FAST_MODEL`) don't have this behavior and, confirmed by testing, actively reject `thinkingConfig` with a `400 INVALID_ARGUMENT`. `client.js` detects "Lite" in the model id (Google's own naming convention) to decide which behavior applies, rather than hardcoding it to the two pinned model names.
- **Any other failure** (network error, invalid request, model error) → wrapped as a generic "temporarily unavailable" `AI_REQUEST_FAILED` error. The real underlying error is logged server-side (`ai_request_failed`, including Gemini's HTTP status/error name) but never returned to the client.
- **Cosmetic-only AI calls never block a core feature.** `bundleService.js`'s label-writing call is wrapped in its own try/catch — if Gemini fails, the "frequently bought together" bundle still returns (just without an AI-written label), because the candidate product set itself is always real DB data, independent of AI.

## Security

- `GEMINI_API_KEY` is read only in `server/services/ai/client.js` via `process.env` — never referenced anywhere in `client/`.
- No AI request/response body is ever logged in full; `client.js` logs only the model name and token counts (`ai_request`) or the model name, HTTP status, and error message (`ai_request_failed`) — never prompts, completions, or the key itself.
- The key is never returned in any API response — `GET /api/v1/ai/health` reports only `{available: boolean}`.
- `.env` is git-ignored; `.env.example` documents the variable name only, never a real value.

## Local testing

```bash
cd server
node -e "import('dotenv/config').then(() => import('./services/ai/client.js')).then(async (m) => {
  console.log('AI available:', m.isAIAvailable());
  const res = await m.createMessage({ model: m.FAST_MODEL, max_tokens: 50, messages: [{ role: 'user', content: 'Reply with exactly: pong' }] });
  console.log('Response:', JSON.stringify(res, null, 2));
});"
```

A successful run prints `AI available: true` and a response containing a `text` block. This calls the real Gemini API (consumes a small amount of your free-tier quota) without needing the rest of the app running.

**This was actually run against the real Gemini API during this integration** — plain text, forced single-tool structured extraction (the pattern used by 6 of the 7 AI features), and the full multi-turn tool-use loop (the shopping assistant) were each independently confirmed working with real, grounded product data from MongoDB, not just mocked. Three real bugs were found and fixed in the process (see git history / code comments in `client.js`): an empty response on non-Lite models caused by invisible "thinking" tokens consuming the whole output budget, a `400` from sending a tool's array result as Gemini's `functionResponse.response` (which requires an object), and a `400` from not echoing back the `thoughtSignature` Gemini attaches to function calls in multi-turn conversations. If you hit a `503`/timeout on your first try, that's very likely genuine free-tier rate-limit pressure (see Error handling above), not a broken integration — wait a few seconds and retry.

Then, with both dev servers running (`npm run dev` from the repo root):

- `GET http://localhost:5000/api/v1/ai/health` → `{"available": true}`
- `POST http://localhost:5000/api/v1/ai/search` with `{"query": "comfortable running shoes under 3000 rupees"}` → real filtered results from your seeded catalog
- Open the storefront and use the floating chat widget (bottom-right) — ask it about a product you've seeded; it should call `search_products`/`get_product_details` and answer only from what those tools return

## Automated tests

`server/tests/aiClient.test.js` mocks `@google/genai` at the SDK boundary and exercises the full Anthropic-shape ↔ Gemini-shape translation (plain text, forced tool calls, the multi-turn tool-result round-trip, synthesized ids, and both quota and generic error paths) — no real API calls. `server/tests/aiFallback.test.js` covers the `GEMINI_API_KEY`-unset graceful-degradation path. The full suite runs with `GEMINI_API_KEY` forcibly blanked (`server/tests/setup.js`), so `npm test` never makes a real Gemini call regardless of what's configured in your local `.env`.
