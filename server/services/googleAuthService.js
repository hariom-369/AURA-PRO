import { OAuth2Client } from 'google-auth-library';
import logger from '../utils/logger.js';

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

let client = null;
function getClient() {
  if (!isGoogleAuthConfigured()) return null;
  if (!client) client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
}

// Verifies a Google Identity Services ID token server-side — the one
// security-critical step: the client can send anything it wants, but only a
// token Google itself signed (checked against Google's public keys inside
// the library) will verify, and `audience` pins it to *this* app's client
// ID so a token issued for a different Google app is rejected too. Nothing
// past this point trusts a client-asserted email, name, or Google user id.
export async function verifyGoogleIdToken(idToken) {
  const oauthClient = getClient();
  if (!oauthClient) {
    const err = new Error('Google sign-in is not configured.');
    err.statusCode = 503;
    throw err;
  }

  let payload;
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (error) {
    logger.warn('google_token_verification_failed', { error: error.message });
    const err = new Error('Invalid or expired Google sign-in session. Please try again.');
    err.statusCode = 401;
    throw err;
  }

  if (!payload?.sub || !payload.email) {
    const err = new Error('Invalid Google sign-in response.');
    err.statusCode = 401;
    throw err;
  }
  // Google only ever sets email_verified: true for an address it has itself
  // confirmed the account controls — an unverified email is not trustworthy
  // enough to create or match an account against.
  if (!payload.email_verified) {
    const err = new Error('Your Google account’s email address is not verified. Please verify it with Google and try again.');
    err.statusCode = 403;
    throw err;
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || '',
  };
}
