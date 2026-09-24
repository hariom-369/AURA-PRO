import { useEffect, useRef, useState } from 'react';
import { loadScriptOnce } from '../utils/loadScript';
import { isGoogleSignInConfigured, GOOGLE_CLIENT_ID } from '../config/authProviders';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

// Google Identity Services' token sign-in flow — hands back a signed ID
// token directly, no OAuth redirect/exchange and no client secret needed
// anywhere. The backend is the only place that token is ever trusted (see
// server/services/googleAuthService.js). Renders nothing if Google sign-in
// isn't configured, so a page never shows a button that can't work.
export default function GoogleSignInButton({ onCredential, onError }) {
  const containerRef = useRef(null);
  const mountedRef = useRef(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isGoogleSignInConfigured()) return undefined;

    loadScriptOnce(GSI_SCRIPT_URL)
      .then(() => {
        if (!mountedRef.current || !containerRef.current || !window.google) return;

        // initialize() is safe (and expected) to call again on every mount —
        // it's how the callback gets rebound per page, since GIS keeps a
        // single global registration rather than one per rendered button.
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) onCredential(response.credential);
            else onError?.('Google sign-in did not return a credential. Please try again.');
          },
        });

        // Defensive: clear before rendering so a re-render (e.g. Strict Mode,
        // or switching Sign in/Create account) never stacks a second button
        // inside the same container.
        containerRef.current.replaceChildren();
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => {
        if (mountedRef.current) setLoadFailed(true);
      });
  }, [onCredential, onError]);

  if (!isGoogleSignInConfigured()) return null;

  if (loadFailed) {
    return (
      <p className="text-center text-xs text-zinc-400">
        Couldn&apos;t load Google sign-in. Check your connection (or ad blocker) and refresh the page.
      </p>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}
