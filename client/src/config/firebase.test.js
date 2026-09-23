import { describe, it, expect, vi, afterEach } from 'vitest';

const ALL_VARS = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];

// firebaseConfig is read from import.meta.env once at module load, so each
// case needs a fresh module import after stubbing env vars — vi.resetModules()
// clears vitest's module cache, the same pattern client/server tests already
// use elsewhere when a module reads process.env/import.meta.env at import time.
async function loadWithEnv(overrides) {
  for (const key of ALL_VARS) vi.stubEnv(key, overrides[key] ?? '');
  vi.resetModules();
  return import('./firebase.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isFirebaseConfigured', () => {
  it('is false when none of the four VITE_FIREBASE_* vars are set', async () => {
    const { isFirebaseConfigured } = await loadWithEnv({});

    expect(isFirebaseConfigured()).toBe(false);
  });

  it('is true only once all four VITE_FIREBASE_* vars are set', async () => {
    const { isFirebaseConfigured } = await loadWithEnv({
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_APP_ID: 'test-app-id',
    });

    expect(isFirebaseConfigured()).toBe(true);
  });

  it('is false when exactly one of the four is missing — the exact condition behind "Sign-in unavailable" when a deploy forgets one build-time var', async () => {
    const { isFirebaseConfigured } = await loadWithEnv({
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      // VITE_FIREBASE_APP_ID intentionally left unset
    });

    expect(isFirebaseConfigured()).toBe(false);
  });
});
