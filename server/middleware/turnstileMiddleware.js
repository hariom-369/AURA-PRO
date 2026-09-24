import ApiError from '../utils/ApiError.js';
import { verifyTurnstileToken, isTurnstileConfigured } from '../services/turnstileService.js';

// Mounted on register/login/forgot-password — the public, abuse-prone
// endpoints. Only enforced when TURNSTILE_SECRET_KEY is actually set, so
// local development without a Turnstile account isn't blocked; production
// is expected to have it configured. Verification happens here, before the
// route handler runs any DB work, so a failed/missing/reused token never
// even reaches account logic — never trust the frontend widget alone.
export const requireTurnstile = async (req, res, next) => {
  if (!isTurnstileConfigured()) return next();

  try {
    const result = await verifyTurnstileToken(req.body.turnstileToken, req.ip);
    if (!result.success) {
      throw new ApiError(400, 'We could not verify you’re not a robot. Please refresh and try again.');
    }
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(400, 'We could not verify you’re not a robot. Please refresh and try again.'));
  }
};
