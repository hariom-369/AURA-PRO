import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { loadScriptOnce } from '../utils/loadScript';
import { isTurnstileConfigured, TURNSTILE_SITE_KEY } from '../config/authProviders';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Cloudflare Turnstile — bot protection on register/login/forgot-password.
// A Turnstile token is single-use, so a failed submit needs a way to force
// a fresh one; exposed via ref.reset() rather than silently trying to reuse
// a spent token. Renders nothing if Turnstile isn't configured, so local
// dev without a Turnstile account isn't blocked.
const TurnstileWidget = forwardRef(function TurnstileWidget({ onVerify, onError }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const mountedRef = useRef(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isTurnstileConfigured()) return undefined;

    loadScriptOnce(TURNSTILE_SCRIPT_URL)
      .then(() => {
        if (!mountedRef.current || !containerRef.current || !window.turnstile) return;
        containerRef.current.replaceChildren();
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onVerify(token),
          'error-callback': () => onError?.('We couldn’t verify you’re not a robot. Please refresh and try again.'),
          // A token expires after a few minutes if the form sits unsubmitted
          // — clear it so a stale/expired token is never silently reused.
          'expired-callback': () => onVerify(''),
        });
      })
      .catch(() => {
        if (mountedRef.current) setLoadFailed(true);
      });

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Already torn down (e.g. the script itself failed) — nothing to clean up.
        }
      }
    };
  }, [onVerify, onError]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  if (!isTurnstileConfigured()) return null;

  if (loadFailed) {
    return <p className="text-xs text-zinc-400">Couldn&apos;t load the verification widget. Refresh the page and try again.</p>;
  }

  return <div ref={containerRef} />;
});

export default TurnstileWidget;
