# Email (SMTP) Setup

AURA PRO sends two kinds of email: **OTP codes** (signup verification, login 2FA — see `server/services/otpService.js`) and **order notifications** (confirmation, status updates, low-stock alerts). Both go through `server/services/emailService.js`, which wraps a single Nodemailer SMTP transporter configured entirely by environment variables — no provider-specific code.

## Environment variables

Set these in `server/.env` (see `server/.env.example` for the full annotated list):

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | Your provider's SMTP hostname |
| `SMTP_PORT` | `587` (STARTTLS, most common) or `465` (implicit TLS) |
| `SMTP_USER` | SMTP username (often your full email, or an API key for some providers) |
| `SMTP_PASSWORD` | SMTP password / app password / API key |
| `EMAIL_FROM_ADDRESS` | The "from" address recipients see |
| `EMAIL_FROM_NAME` | The "from" display name (defaults to `AURA PRO`) |
| `OTP_DEV_FALLBACK` | Dev-only escape hatch — see [Local development](#local-development-without-smtp) below |

**If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` are all left blank**, `isEmailConfigured()` returns `false` and the app degrades gracefully everywhere except OTP delivery, which is covered separately below.

## Choosing a provider

**For local development**, a Gmail account with an App Password is the fastest path (no signup, no verification wait):
1. Enable 2-Step Verification on the Google account: [myaccount.google.com/security](https://myaccount.google.com/security)
2. Create an App Password: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → app "Mail" → copy the 16-character password
3. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=youraddress@gmail.com
   SMTP_PASSWORD=<the 16-character app password, no spaces>
   ```

**For production**, use a real transactional provider — Gmail is not meant for production volume/deliverability. Any of these work as-is (same SMTP interface, just different host/credentials):

| Provider | SMTP host | Notes |
| --- | --- | --- |
| [Brevo](https://www.brevo.com) | `smtp-relay.brevo.com` | Generous free tier, good for starting out |
| [Resend](https://resend.com) | `smtp.resend.com` | Developer-friendly, simple setup |
| [SendGrid](https://sendgrid.com) | `smtp.sendgrid.net` | `SMTP_USER=apikey`, `SMTP_PASSWORD=<your API key>` |
| [Mailgun](https://mailgun.com) | `smtp.mailgun.org` | Requires domain verification (SPF/DKIM) before sending |
| [Amazon SES](https://aws.amazon.com/ses/) | region-specific | Cheapest at scale, more setup (domain verification, sending limits) |

Whichever you pick, **verify your sending domain** (SPF/DKIM records) once you're past initial testing — unverified domains get flagged as spam by most inbox providers.

### ⚠️ The most common "it says sent but I never got it" cause

**`EMAIL_FROM_ADDRESS` must match `SMTP_USER` when using Gmail or Outlook/Office365.** These providers accept the SMTP transaction either way (Nodemailer will report `success: true`, and it genuinely isn't lying — the message really was accepted for delivery), but if the `From:` address doesn't match the authenticated account, the message's DKIM signature (signed for `gmail.com`) won't align with the claimed From domain. That fails DMARC on the *receiving* server, which then silently drops or spam-filters the message — invisibly, with no bounce, nothing Nodemailer can detect or report.

This app detects the misconfiguration itself and logs a warning (`email_from_address_mismatch`) the first time it happens — but the underlying fix is simply:
```
SMTP_USER=youraddress@gmail.com
EMAIL_FROM_ADDRESS=youraddress@gmail.com   # ← must be the same address
```
If you want a *different*, branded From address (e.g. `orders@aurapro.com`) while authenticating as a personal Gmail account, you'd need to add it as a verified "Send As" alias in Gmail's own settings (Settings → Accounts → Send mail as) — or, more simply, switch to a domain-verified transactional provider (Brevo/Resend/SendGrid/Mailgun/SES), where any address on your verified sending domain works without this restriction.

**How to tell this is happening:** `verifyEmailConnection()` returning `{ ok: true }` only proves your credentials and connection work — it sends nothing and can't detect this. The real signal is in the server log: an `email_sent` entry with a real `smtpResponse` (e.g. `250 2.0.0 OK ... gsmtp`) for every attempt, but nothing ever arrives. That combination — success logged, provider is Gmail/Outlook, `EMAIL_FROM_ADDRESS` ≠ `SMTP_USER` — is this exact issue.

## Local development without SMTP

If you haven't configured SMTP yet, OTP registration/login still work: the code is logged to the server console and returned in the API response as `devCode`, and the UI shows it in an amber "Dev mode" banner instead of a real email. This is controlled by two **independent, explicit** gates in `otpService.js` — both must allow it:

1. `NODE_ENV` must not be `production` (hardcoded — not configurable, no exceptions)
2. `OTP_DEV_FALLBACK` must not be set to `false` (defaults to allowed; set to `false` in your `.env` to disable it even in dev)

**In production, if email delivery fails, the request fails with a clear 503 error instead** — the OTP is never exposed as a fallback. This is enforced in code, not just by convention (`server/tests/otp.test.js` has dedicated tests asserting no `devCode` ever appears in a production response).

## Testing real delivery

### Without any real inbox (Ethereal — recommended first check)

Nodemailer can spin up a temporary, real SMTP test account with **zero signup**. This sends over a genuine SMTP connection and gives you a shareable preview link to see the actual rendered email:

```bash
cd server
node -e "
import('nodemailer').then(async ({ default: nodemailer }) => {
  const testAccount = await nodemailer.createTestAccount();
  process.env.SMTP_HOST = testAccount.smtp.host;
  process.env.SMTP_PORT = String(testAccount.smtp.port);
  process.env.SMTP_USER = testAccount.user;
  process.env.SMTP_PASSWORD = testAccount.pass;

  const emailService = await import('./services/emailService.js');
  const result = await emailService.sendOtpEmail('you@example.com', '123456', 'SIGNUP_VERIFICATION');
  console.log(result); // check the server log line above for a previewUrl
});
"
```

Watch the console — `email_sent` log lines include a `previewUrl` field whenever the transporter is an Ethereal test account (this is automatically a no-op for every real provider, safe to leave in permanently).

### With your real SMTP credentials

1. Fill in `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` in `server/.env`
2. Verify the connection without sending anything:
   ```bash
   cd server
   node -e "import('dotenv/config').then(() => import('./services/emailService.js')).then(m => m.verifyEmailConnection()).then(console.log)"
   ```
   `{ ok: true }` means your credentials and connection are valid.
3. Register a real account through the app (`http://localhost:5173/register`) using an email address you can actually check, and confirm the code arrives.

### In production

Same as above, but set the environment variables on your hosting platform (see `docs/DEPLOYMENT.md`) rather than a local `.env` file, and make sure `NODE_ENV=production` is set — that's what fully disables the dev fallback.

## Diagnostic logging

`server/services/emailService.js` logs (never including the OTP code, password, or SMTP credentials):

- `email_sent` — includes the provider's raw SMTP response line (e.g. `250 2.0.0 OK ...`) and, for Ethereal test accounts only, a `previewUrl`
- `email_rejected_by_provider` — the SMTP transaction resolved without throwing, but the target recipient wasn't in the provider's `accepted` list (a real, explicit rejection at the protocol level)
- `email_send_failed` — `sendMail()` threw (auth failure, network error, etc.), with the real error message
- `email_from_address_mismatch` — logged once, the first time a Gmail/Outlook-style host is used with a `From:` address that doesn't match the authenticated account (see the warning box above)

None of these ever report success unless the provider's own response confirms the recipient was accepted — a resolved promise alone is not treated as proof of delivery.

## A note on the test suite

`server/tests/setup.js` forcibly blanks `SMTP_*`, `STRIPE_*`, `GEMINI_API_KEY`, and `CLOUDINARY_*` before any test file is imported, regardless of what's configured in your real `server/.env`. This matters: `app.js` calls `dotenv.config()` at import time, and dotenv never overwrites a `process.env` key that's already set — so once you configure real credentials for local development, the test suite needs to explicitly protect itself from picking them up, or `npm test` would start making real (and, for OTP tests specifically, repeated/automated-looking) calls to your real SMTP provider on every run.
