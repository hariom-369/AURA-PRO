import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// These values are Firebase's public web-app config — safe to ship in the
// client bundle by Firebase's own security model (real enforcement happens
// via Firebase Security Rules / API-key domain restriction in Google Cloud
// Console, not by keeping this secret). They're still centralized here
// rather than hardcoded, and read from VITE_-prefixed env vars per Vite's
// convention for what's exposed to the client build.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

let app = null;
let authInstance = null;

// Lazy + guarded: if phone auth isn't configured (or a value is missing),
// this returns null instead of throwing, so importing this module never
// breaks the rest of the app — the existing email/password/OTP login is
// completely independent of whether Firebase is set up at all.
export function getFirebaseAuthClient() {
  if (!isFirebaseConfigured()) return null;
  if (authInstance) return authInstance;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  authInstance = getAuth(app);
  return authInstance;
}
