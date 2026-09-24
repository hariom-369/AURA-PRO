# Email (Resend)

AURA PRO sends order notification emails (confirmation, status updates, low-stock alerts to admins) **and password-reset emails**. These go through `server/services/emailService.js`, which wraps the official [Resend](https://resend.com) Node.js SDK. See [docs/AUTHENTICATION.md](AUTHENTICATION.md) for the full sign-in system — email/password and Google Sign-In.

This app previously used Gmail SMTP. It was replaced because Gmail SMTP connections from most cloud hosts (including Render) are unreliable — frequently rejected outright (`ENETUNREACH`, connection timeouts) since providers commonly block outbound SMTP ports (25/465/587) on shared infrastructure to fight spam. Resend sends over a normal HTTPS API call, which isn't affected by that class of problem.

## Environment variables

Set these in `server/.env` (see `server/.env.example` for the full annotated list):

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Your Resend API key — get one at [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM_ADDRESS` | The "from" address recipients see — must be on a domain you've verified with Resend (see below), or the special `onboarding@resend.dev` testing address |
| `EMAIL_FROM_NAME` | The "from" display name (defaults to `AURA PRO`) |

**If `RESEND_API_KEY` is left blank**, `isEmailConfigured()` returns `false` and order emails are logged instead of sent — this never blocks checkout or any other core flow, since order emails are strictly best-effort notifications.

## Getting a Resend API key

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month, 100/day — plenty for order volume at small-to-medium scale).
2. Go to [resend.com/api-keys](https://resend.com/api-keys) → **Create API Key**. For this app, a key with **Sending access** only is enough — it never needs to manage domains, contacts, etc. through the API.
3. Copy the key (starts with `re_`) into `RESEND_API_KEY` in `server/.env` (and in your Render environment variables for production — see [Production configuration](#production-render) below).

### ⚠️ You must verify a sending domain before real production delivery

Resend will not deliver mail from an address on a domain it hasn't verified you control — this is the single most common "I set the API key but nothing arrives" cause, same role Gmail's SPF/DKIM alignment played before.

1. In the Resend dashboard: **Domains → Add Domain**, enter a domain you own (e.g. `aurapro.com`, or a subdomain like `mail.aurapro.com`).
2. Add the DNS records Resend gives you (SPF, DKIM, and typically a DMARC record) at your domain registrar/DNS host. Verification is usually near-instant once DNS propagates, but can take up to ~30 minutes.
3. Once verified, set `EMAIL_FROM_ADDRESS` to any address `@yourdomain.com` — you don't need to create real mailboxes for it, just the DNS records.

**Until you've done this**, use the built-in `onboarding@resend.dev` sender for local development — it works with zero setup, but Resend restricts it to only deliver to the email address on your own Resend account. This is enforced by Resend itself, not this app.

## Local development without Resend

If you haven't configured `RESEND_API_KEY`, order confirmation/status/low-stock emails are simply logged (`email_skipped_not_configured`) instead of sent — checkout is unaffected either way. **Password reset is the one flow that does depend on this**: without it, `forgot-password` still responds successfully (its response is always the same generic message, by design — see docs/AUTHENTICATION.md), but no email actually arrives, so you can't complete a reset locally without a real `RESEND_API_KEY`. Register/login/Google sign-in don't depend on email at all.

## Testing real delivery

1. Fill in `RESEND_API_KEY` (and, once verified, a real domain's `EMAIL_FROM_ADDRESS`) in `server/.env`.
2. Verify the API key without sending anything:
   ```bash
   cd server
   node -e "import('dotenv/config').then(() => import('./services/emailService.js')).then(m => m.verifyEmailConnection()).then(console.log)"
   ```
   `{ ok: true }` means your API key is valid. This does **not** prove a specific From address/domain will deliver — that's confirmed by an actual send (next step).
3. Place a real order through the app (checkout with the test-mode Stripe card, `4242 4242 4242 4242`) using an account whose profile email you can actually check, and confirm the confirmation email arrives. With `onboarding@resend.dev` as your From address, this only works if that email is the same one on your Resend account.
4. For a specific one-off send (e.g. to test a template change) without placing a real order:
   ```bash
   cd server
   node -e "import('dotenv/config').then(() => import('./services/emailService.js')).then(m => m.sendLowStockAlertEmail('you@example.com', { name: 'Test Product', sku: 'TEST-1', stock: 2, lowStockThreshold: 5 })).then(console.log)"
   ```

## Production configuration (Render) {#production-render}

Set these in your Render service's **Environment** tab:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Your real Resend API key |
| `EMAIL_FROM_ADDRESS` | An address on a domain verified in the Resend dashboard (never `onboarding@resend.dev` in production — it can't deliver to arbitrary recipients) |
| `EMAIL_FROM_NAME` | `AURA PRO` (or your preferred display name) |
| `NODE_ENV` | `production` |

If order emails — or password-reset emails — aren't arriving in production, check (in order): the domain verification status in the Resend dashboard, the `email_rejected_by_provider` / `email_send_failed` log lines (see below) for the actual Resend error, and that `EMAIL_FROM_ADDRESS` is really on the verified domain.

## Diagnostic logging

`server/services/emailService.js` logs (never including the API key or any other credential):

- `email_sent` — includes Resend's own message id for the sent email
- `email_rejected_by_provider` — Resend's API call resolved (no exception) but returned an `error` instead of a successful `data` — includes the error's `name` (e.g. `invalid_from_address`, `rate_limit_exceeded`) and `message`
- `email_send_failed` — the API call itself threw (network failure, etc.), with the real error message
- `email_skipped_not_configured` — `RESEND_API_KEY` isn't set; logged at `info`, not `error`, since this is expected in dev

None of these ever report success unless Resend's own response confirms the message was accepted (a `data.id` with no `error`) — a resolved promise alone is not treated as proof, and unlike a thrown exception, Resend's SDK resolves even on a rejected send, so `sendEmail()` explicitly checks for `error` on every call rather than relying on try/catch alone.

## A note on the test suite

`server/tests/setup.js` forcibly blanks `RESEND_API_KEY`, `STRIPE_*`, `GEMINI_API_KEY`, `CLOUDINARY_*`, `GOOGLE_CLIENT_ID`, and `TURNSTILE_SECRET_KEY` before any test file is imported, regardless of what's configured in your real `server/.env`. This matters: `app.js` calls `dotenv.config()` at import time, and dotenv never overwrites a key that's already present in `process.env` — so once you configure real credentials for local development, the test suite needs to explicitly protect itself from picking them up, or `npm test` would start making real calls to your real Resend account on every run. `server/tests/emailDelivery.test.js` mocks the Resend SDK directly (`vi.mock('resend', ...)`) to test the request/response handling — including the "resolves with an error instead of throwing" case that's specific to how Resend's SDK behaves — without ever calling the real API. `server/tests/passwordReset.test.js` similarly mocks `sendPasswordResetEmail` at the service boundary.
