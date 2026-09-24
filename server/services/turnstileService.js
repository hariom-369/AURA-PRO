import logger from '../utils/logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Verifies a Cloudflare Turnstile challenge token server-side — a frontend
// check alone proves nothing, since a bot can simply skip rendering the
// widget and call the API directly. `secret` never leaves the backend.
// Every caller of this must reject the request before doing any account
// work if this returns false (or throws) — never trust the token client-side.
export async function verifyTurnstileToken(token, remoteIp) {
  if (!isTurnstileConfigured()) {
    // Fails closed in an environment that's supposed to have it configured
    // (production), but the caller decides whether Turnstile is required at
    // all — see requireTurnstile in middleware/turnstileMiddleware.js, which
    // only enforces this when TURNSTILE_SECRET_KEY is actually set, so local
    // dev without a Turnstile account isn't a dead end.
    return { success: false, reason: 'not_configured' };
  }
  if (!token || typeof token !== 'string') {
    return { success: false, reason: 'missing_token' };
  }

  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await res.json();

    if (!data.success) {
      logger.warn('turnstile_verification_failed', { errorCodes: data['error-codes'] || [] });
      return { success: false, reason: (data['error-codes'] || [])[0] || 'verification_failed' };
    }
    return { success: true };
  } catch (error) {
    logger.error('turnstile_request_failed', { error: error.message });
    return { success: false, reason: 'request_failed' };
  }
}
