# Firebase Phone Authentication

AURA PRO's **only** sign-in method is Firebase Phone Authentication — SMS-verified phone sign-in. There is no email/password/OTP login of any kind.

Both new and returning users go through the same flow (see `PhoneLoginStep.jsx`): pick "Shop" or "Sell" (pure frontend intent — see below), enter a phone number, receive a 6-digit SMS code, confirm it. Firebase itself does the verification; the backend never sees a phone number it hasn't cryptographically confirmed ownership of.

`/login` shows a "Sign in" / "Create account" toggle before the phone form. Functionally both are the *same* verification call — the only difference is that "Create account" also collects a **full name**, sent as an optional `name` field on `POST /auth/firebase/phone-login`. The backend uses it **only** when creating a brand-new account (falling back to a placeholder if omitted); it's silently ignored for a returning login or a claimed legacy account, so it can never be used to rename an existing account. The "Buyer" vs "Seller" choice on the same page is **not** a role or account type — it only changes post-login copy/redirect (buyer → home; seller → the seller dashboard if approved, the application status page, or onboarding, depending on `Seller.status`). Nothing about it is trusted by the backend.

## How it works

Firebase verifies a phone number and hands the backend a **Firebase ID token**. `server/config/firebaseAdmin.js` / `server/services/firebasePhoneAuthService.js` verify that token server-side (`admin.auth().verifyIdToken`) and then call `user.generateAuthToken()` — the same JWT session every other part of the app (`authMiddleware.protect`, `adminOnly`, `ProtectedRoute`/`AdminRoute`/`SellerRoute` on the frontend) already understands. Firebase is used for exactly one thing: proving phone ownership before the backend mints an ordinary app token.

- `User.firebaseUid` (unique, sparse) is the sole identity anchor for login — not `email`, not `password` (neither field exists in the schema at all). Firebase itself already guarantees one `uid` per verified phone number within its own user pool.
- `User.email` still exists as optional profile metadata (used for order-email delivery and display), but has no bearing on authentication.

## Account model: new signup, returning login, and claiming a pre-existing account

**Sign-in logic** (`findOrCreateUserFromFirebase` in `firebasePhoneAuthService.js`):

1. `firebaseUid` already known → log that user in. Done.
2. Not known yet, but an existing account already has this phone number in its `phone` field **and has never been claimed by any Firebase identity** (`firebaseUid` unset) → **claim it**: attach this `firebaseUid` to that account, mark it phone-verified, and record an `AuditLog` entry (`user.firebase_phone_claimed`). The account's existing role, orders, and history are untouched — only its login method changes. This is how a legacy account (e.g. one that predates this app's move to phone-only auth) becomes reachable again.
3. Not known yet, and no account has this phone number at all → create a brand new customer account. `role` always defaults to `'customer'` — there is no admin path via phone sign-up, ever, regardless of anything the client sends.

**Why claiming (not blocking) is safe here**: an earlier version of this app also supported email/password login, and a phone number matching an existing legacy account was deliberately *blocked* rather than merged, with the person told to log in with email/password instead — a real, less-trusted, always-available fallback existed. Once email/password login was removed entirely, that fallback no longer exists, so blocking would leave the account's real owner with no way back in at all. Firebase's SMS verification is a materially stronger signal than a client-asserted match — the person has proven, right now, that they possess the exact phone number on file — so attaching (not merging accounts, not creating a duplicate) is the safe resolution. This only ever fires for an account with **no other login path left**; an already-claimed account is never touched by this branch, and there is still no scenario where two different accounts get silently merged into one.

## reCAPTCHA lifecycle — a real SDK gotcha, not a hypothetical one

`client/src/services/firebaseAuthService.js` creates **one** invisible `RecaptchaVerifier` and reuses it for every send and resend, rather than destroying and recreating one per call. This matters because `RecaptchaVerifier.clear()` is a no-op on the DOM for an invisible verifier (confirmed by reading the installed `@firebase/auth` source directly — it only removes child nodes `if (!this.isInvisible)`), so recreating a verifier bound to the same container without also manually clearing that container's DOM causes Google's own `grecaptcha.render()` to throw **"reCAPTCHA has already been rendered in this element"** — it still has last time's widget in it. `resetRecaptcha(containerId)` therefore always clears the container's DOM itself as well, and is only ever called on a genuine teardown (component unmount, or Firebase reporting the captcha challenge itself is invalid via `auth/captcha-check-failed`) — never on an ordinary resend or a "use a different number," since the already-solved invisible challenge isn't tied to any particular phone number. See `client/src/services/firebaseAuthService.test.js` for tests that reproduce this exact collision against a mocked SDK.

## What I could not verify myself

I have no access to the Firebase Console, Render, or Cloudflare Pages dashboards. Everything below "Manual setup" is something only you can perform and confirm — the flow is implemented and passes mocked tests (`server/tests/firebaseAuth.test.js`, `client/src/components/PhoneLoginStep.test.jsx`) that never call the real Firebase or Google APIs, but a live end-to-end phone sign-in has not been (and cannot be) run from this environment.

## Costs and the free tier

Verified against `firebase.google.com/pricing`: **Phone Auth SMS is billed on the Blaze plan only — the Spark (free) plan lists it "Not applicable."** Firebase's **test phone numbers** (Console → Authentication → Sign-in method → Phone → *Phone numbers for testing*, up to 10, each with a fixed 6-digit code) are designed to let you build and test the entire flow without sending a real SMS. If the Console prompts you to enable billing at any point while setting these up, stop and check before proceeding. **Real SMS (Blaze plan) costs roughly $0.01–$0.46 per message depending on the recipient's country** — nothing in this codebase enables or requires Blaze; that decision is entirely yours, made in the Firebase Console.

## Manual setup (Firebase Console)

1. **Create a project**: [console.firebase.google.com](https://console.firebase.google.com) → Add project.
2. **Authentication → Sign-in method → Phone** → Enable.
3. **Phone numbers for testing** (same screen) → add up to 10 fictional numbers + 6-digit codes. No real SMS, and per the pricing page, phone auth is otherwise "not applicable" on the free plan — this is the intended free way to develop and test.
4. **Project settings → General → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values (public, not secret).
5. **Project settings → Service accounts → Generate new private key** → downloads a JSON file (secret, backend-only — never commit it, never send it to the frontend).

## Environment variables

Both sides are **required** — without them, no one can sign in at all.

### Backend (Render) — from the downloaded service account JSON, never the whole file

| Variable | Source in the JSON |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` — paste exactly as given, including `\n` sequences and the BEGIN/END lines |

### Frontend (Cloudflare Pages) — from the web app config, public values

| Variable | Source |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `firebaseConfig.apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `firebaseConfig.authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `firebaseConfig.projectId` |
| `VITE_FIREBASE_APP_ID` | `firebaseConfig.appId` |

Cloudflare Pages env vars are build-time (same as `VITE_API_URL`) — set them in the Pages project's **Settings → Environment variables**, then trigger a new deployment (they won't apply to an already-built deploy).

## Bootstrapping your first admin

There is no admin self-registration. To make an account an admin:

1. Sign in once through the app with the phone number you want as admin (this creates or claims its `User` document).
2. Run `node seeds/seedAdmin.js <phone-number>` against that database — it promotes the matching account to `role: 'admin'`. The phone number must match exactly what's stored (the same value Firebase reports, e.g. `+15551234567`).

## Testing locally

1. Add the three `FIREBASE_*` vars to `server/.env` and the four `VITE_FIREBASE_*` vars to `client/.env`.
2. `cd server && npm run dev`, `cd client && npm run dev`.
3. On `/login`, enter one of your configured test numbers (with country code) → "Send code" → enter its fixed 6-digit code → should land you in a normal logged-in session.
4. Confirm a phone-authenticated session can reach protected routes (`/orders`, `/account/profile`, etc.), and that `/register` and `/forgot-password` both redirect to `/login`.

## Automated tests

- `server/tests/firebaseAuth.test.js` mocks `firebase-admin/app` and `firebase-admin/auth` at the SDK boundary — covers new-account creation, returning-user login (no duplicate), claiming an existing unclaimed account (preserving its role, writing an `AuditLog` entry), rejecting a claim against a deactivated account, invalid/expired tokens, a missing phone number on an otherwise-valid token, a deactivated already-claimed account, role always defaulting to `customer` even if the request body tries to set it, the optional `name` field being applied only on first-time signup (and ignored/rejected otherwise), and that the issued token works against an existing protected route.
- `client/src/components/PhoneLoginStep.test.jsx` mocks `services/firebaseAuthService.js` at its boundary — covers the send-code → enter-code → session flow, client-side + Firebase-error validation with friendly (never raw) messages, the resend cooldown, "use a different number", reCAPTCHA reset on unmount, and duplicate-submission prevention.
- `client/src/services/firebaseAuthService.test.js` mocks `firebase/auth` directly — covers the reCAPTCHA lifecycle itself: the verifier is created once and reused across sends/resends, an unwrapped grecaptcha "already rendered" collision is normalized and the widget torn down for a clean retry, an ordinary Firebase error does *not* tear the verifier down, and `resetRecaptcha` clears the container DOM.
- `client/src/pages/Login.test.jsx` — role selection, the sign-in/create-account toggle and name-field visibility, route-state preselection (e.g. from "Start selling"), and the role-aware post-login redirect (buyer → home; seller → dashboard/status/onboarding depending on `Seller.status` and whether they signed up or just signed in).
- `client/src/utils/phone.test.js`, `client/src/utils/firebaseAuthErrors.test.js` — pure-function coverage for phone normalization/masking and Firebase error-code-to-message mapping.
