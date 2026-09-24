# Authentication

AURA PRO's sign-in methods are **email + password** and **Google Sign-In**. There is no Firebase, no phone/SMS authentication, and no paid SMS of any kind — that system was fully removed (see "Migrating from Firebase Phone Auth" below for what happens to accounts created under it).

## How it works

### Email + password

`POST /api/v1/auth/register` creates an account (`server/controllers/authController.js`). Passwords are hashed with **Argon2id** (`@node-rs/argon2`, via a `pre('save')` hook on `User` — see `server/models/User.js`) and never stored in plain text or returned by any API response (`password` has `select: false` in the schema, so a plain `find()`/`findById()` never even fetches it). `POST /api/v1/auth/login` verifies the password and issues a JWT the same way every other part of the app already understands (`user.generateAuthToken()`, checked by `authMiddleware.protect`).

Login failures are **deliberately generic**: whether the email doesn't exist, has no password (a Google-only account), or the password is simply wrong, the response is the exact same `401 Invalid email or password.` — this never reveals whether an email is registered.

### Google Sign-In

Uses **Google Identity Services (GIS)**, not the deprecated `gapi.auth2`. `client/src/components/GoogleSignInButton.jsx` loads `accounts.google.com/gsi/client` and renders the standard button; GIS hands back a signed **ID token** directly to the frontend — there is no OAuth redirect/code-exchange, and consequently **no client secret exists anywhere in this app**. The backend (`server/services/googleAuthService.js`) verifies that ID token server-side with the official `google-auth-library`'s `OAuth2Client.verifyIdToken()`, checking the signature against Google's public keys and pinning `audience` to this app's own Client ID. Nothing past that point trusts a client-asserted email, name, or Google user ID — only what Google's own verified response says.

- `POST /api/v1/auth/google` — sign in (existing `googleId`) or sign up (brand-new email) in one call.
- `POST /api/v1/auth/me/link-google` — **authenticated only**: links a Google identity to the account you're already signed into. This is the "reauthentication before linking" step: you must already have proven who you are via your existing credential (password) before a Google identity can be attached, and it only ever affects your own already-authenticated session — never a login/signup path itself.

### Account-linking policy — never auto-merge

If a Google sign-in's (Google-verified) email matches an **existing password account that hasn't linked Google yet**, the backend rejects with `409` and a specific message — it never logs the person in and never creates a duplicate account. The only way to attach Google to that account is the authenticated "Link Google account" action in Profile settings (`client/src/pages/Profile.jsx`), which requires signing in with the password first.

Registering email/password with an email that already has a **Google-only account** (no password set) is rejected the same way, pointing at "Forgot password" as the recovery path. Successfully completing a password reset — which requires receiving and clicking a link sent to that exact inbox — is itself a strong enough proof of ownership to add a password to that account, so it's allowed there.

### Buyer/Seller — not a role

The Register page's Buyer/Seller toggle is **pure frontend intent**, never sent to or trusted by the backend. Every account is created with `role: 'customer'` regardless of which one is selected; "Seller" only changes where you land after account creation (`/sell/onboarding` — the existing, unmodified, admin-reviewed seller application flow). There is still no way to become a seller (or admin) except that existing approval process — see `docs/MARKETPLACE.md`.

## Sessions and "remember me"

Sessions remain **JWT + `Authorization: Bearer` header**, stored client-side — the same architecture every protected route/dashboard in this app was already built on. This was a deliberate choice, not an oversight: the frontend (Cloudflare Pages) and backend (Render) are different origins, so a cookie-based session would need `SameSite=None; Secure`, is subject to increasingly aggressive third-party-cookie blocking in exactly that cross-site setup, and would require re-plumbing CORS/axios/every protected route for a change that wasn't required. See `client/src/utils/tokenStorage.js`.

"Remember me" is implemented by **where** the token is stored, not a different mechanism:
- Checked → `localStorage` (persists across browser restarts), paired with the normal 30-day token.
- Unchecked (default) → `sessionStorage` (cleared when the tab closes), paired with a short-lived 1-day token.

Only one storage ever holds a token at a time; `getToken()` checks both so a page reload restores the session either way.

## Bot protection — Cloudflare Turnstile

`register`, `login`, and `forgot-password` are protected by [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (`client/src/components/TurnstileWidget.jsx`, `server/middleware/turnstileMiddleware.js`, `server/services/turnstileService.js`). The token is verified server-side against Cloudflare's `siteverify` endpoint using a backend-only secret key — **the frontend widget alone proves nothing**; a missing, invalid, expired, or reused token is rejected before any validation or database work happens. Turnstile is layered *with*, not instead of, per-route rate limiting (`authLimiter`, unchanged, 10 requests/hour) — neither is a complete answer to abuse on its own.

Turnstile enforcement is only active when `TURNSTILE_SECRET_KEY` is set — unset (the default for local development), the middleware passes every request through unchanged, so working on this app locally never requires a Turnstile account.

## Migrating from Firebase Phone Auth

This app previously used Firebase Phone Authentication exclusively. That system has been fully removed: no Firebase dependency, no reCAPTCHA, no phone/SMS flow of any kind remains. `User.firebaseUid` and `User.phoneVerified` are **left in the schema, untouched** — no destructive migration was performed, and any account created under the old system keeps its data (orders, seller applications, everything) exactly as it was.

**A legacy phone-only account has no password and (usually) no email**, so it has no login path under the new system — it becomes dormant, not deleted. If you need to recover a specific legacy account, add an email and use the normal registration/password-reset flow to give it a real credential (a direct, one-off database update — there's no built-in self-service migration path, since a phone number alone isn't proof of a specific email address).

## Environment variables

Both Google Sign-In and Turnstile are **optional** — each feature just doesn't render/enforce when its key is unset, so local development needs neither configured.

### Backend (Render)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Same public Client ID as the frontend's `VITE_GOOGLE_CLIENT_ID` — used only as the expected `audience` when verifying a Google ID token, never as a secret. |
| `TURNSTILE_SECRET_KEY` | Backend-only, never exposed to the frontend. |

### Frontend (Cloudflare Pages, build-time)

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Public Google OAuth Client ID. |
| `VITE_TURNSTILE_SITE_KEY` | Public Turnstile Site Key. |

Cloudflare Pages env vars are build-time — set them in the Pages project's **Settings → Environment variables**, then trigger a new deployment (they won't apply to an already-built deploy).

## Google Cloud Console setup

1. [console.cloud.google.com](https://console.cloud.google.com) → select/create a project → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID → Web application.**
3. Under **Authorized JavaScript origins**, add your frontend's real origin(s) (e.g. `http://localhost:5173` for dev, your Cloudflare Pages domain for production) — GIS requires this to match exactly.
4. Copy the **Client ID** (not the secret — none is needed) into `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend).
5. If prompted, configure the **OAuth consent screen** (app name, support email) — required before the Client ID will work, even in testing mode.

## Cloudflare Turnstile setup

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Turnstile → Add a site**.
2. Add your frontend's domain(s). Choose the **Managed** challenge mode (Cloudflare decides when to show an interactive challenge vs. running invisibly) unless you have a specific reason to choose otherwise.
3. Copy the **Site Key** into `VITE_TURNSTILE_SITE_KEY` (frontend) and the **Secret Key** into `TURNSTILE_SECRET_KEY` (backend, never the frontend).

## Testing locally

```bash
cd server && npm run dev
cd client && npm run dev
```

- Register/login/forgot-password/reset-password all work with no Google/Turnstile configuration at all.
- To test Google Sign-In locally, add `http://localhost:5173` as an authorized JavaScript origin in Google Cloud Console (step 3 above), then set both `GOOGLE_CLIENT_ID` env vars.
- To test Turnstile locally, Cloudflare provides [dedicated test site keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) that always pass/fail predictably without needing a real domain.

## Automated tests

- `server/tests/auth.test.js` — register (success, duplicate email, invalid email, weak password, password mismatch, terms not accepted, role/accountType never trusted from the request body), login (success, wrong password, nonexistent email — both with the identical generic message, deactivated account, remember-me token expiry), authorization (buyer blocked from seller/admin routes), change-password.
- `server/tests/passwordReset.test.js` — enumeration-safe forgot-password response, email only sent for a real account, reset success, token reuse rejected, expired token rejected, token never appears in a log line.
- `server/tests/googleAuth.test.js` — mocks `google-auth-library` at the SDK boundary: new account creation (role never trusted from the request), returning login (no duplicate), invalid/expired credential, unverified email rejected, no-auto-merge into an existing password account, deactivated account, and the full `link-google` flow (requires auth, rejects double-linking, rejects hijacking another account's Google identity).
- `server/tests/turnstile.test.js` — mocks the Cloudflare `siteverify` call: passes through when unconfigured, rejects a missing/invalid/expired token before any DB work, never leaks the secret key.
- `client/src/pages/Login.test.jsx`, `Register.test.jsx`, `ForgotPassword.test.jsx`, `ResetPassword.test.jsx` — full form flows, validation, loading/disabled states, remember-me storage location, error handling.
- `client/src/components/GoogleSignInButton.test.jsx`, `TurnstileWidget.test.jsx` — script-loading, initialization, credential/token callbacks, load-failure fallback — all against a mocked `window.google`/`window.turnstile`, never the real script.
- `client/src/utils/tokenStorage.test.js`, `passwordStrength.test.js`, `loadScript.test.js` — pure-function/utility coverage.
