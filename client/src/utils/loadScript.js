// Loads an external <script> exactly once, no matter how many times or how
// many different components call this for the same URL — every caller gets
// the same cached promise. This is deliberately centralized: the earlier
// Firebase reCAPTCHA integration in this app had real, hard-to-debug bugs
// from re-initializing an external widget/script multiple times (see
// docs/AUTHENTICATION.md and the removed docs/FIREBASE_AUTH.md history) —
// Google Identity Services and Cloudflare Turnstile both load an external
// script the same way, so this exists to make that mistake impossible here.
const loadedScripts = new Map();

export function loadScriptOnce(src) {
  if (loadedScripts.has(src)) return loadedScripts.get(src);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}
