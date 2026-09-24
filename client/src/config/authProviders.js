// Public, non-secret config — a Google OAuth Client ID and a Turnstile Site
// Key are both meant to be shipped in the client bundle (real enforcement
// happens server-side: verifying the Google ID token's audience, and
// verifying the Turnstile response with the backend-only secret key).
export function isGoogleSignInConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

export function isTurnstileConfigured() {
  return Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
