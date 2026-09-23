import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

let app = null;
function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Service-account JSON keys contain literal newlines in the private
      // key; most env-var UIs (Render included) can't store a real newline,
      // so the value is stored with escaped "\n" sequences and un-escaped
      // here. A key pasted with real newlines already still works, since
      // there's nothing to replace in that case.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  return app;
}

// null when Firebase isn't configured — callers must check before use,
// same isXConfigured()/getX() pattern as config/cloudinary.js.
export function getFirebaseAuth() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  return getAuth(firebaseApp);
}
