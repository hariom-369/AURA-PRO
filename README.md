# AURA PRO — AI-Powered Multi-Vendor E-Commerce Marketplace

AURA PRO is a full-stack MERN e-commerce marketplace (MongoDB, Express, React, Node.js) supporting customer, seller, and admin roles, with an AI service layer built on the Google Gemini API, a Tailwind-based premium storefront, Stripe payments, Cloudinary media, and a role-based admin studio.

---

## What's actually in this repo

This README describes the real, current state of the codebase — not an aspirational one. If a feature below needs an API key you haven't configured yet, the app is designed to **degrade gracefully**, not crash: AI features return a clear "temporarily unavailable" response, email sends log instead of failing silently, and image upload returns a clear 503 until Cloudinary is configured.

### AI Features (Google Gemini)

All AI endpoints live under `/api/v1/ai` and share one rule: **the model must ground every product/order fact in a real database record via a tool call — it never answers price, stock, or policy questions from memory.** Full integration details (model choice, the request/response translation layer, error handling, local testing): **[docs/AI.md](docs/AI.md)**.

| Feature | How it works |
| --- | --- |
| **Shopping + support assistant** | `/ai/chat` — a tool-use loop (`search_products`, `get_product_details`, `get_order_status`) grounded in real catalog/order data, plus a static `server/content/policies.md` for shipping/returns Q&A. Floating widget on every page. |
| **Semantic search** | `/ai/search` — natural language ("comfortable shoes for daily use under ₹2000") is converted to structured filters (category, price range, sort) by Gemini, then run as a normal MongoDB query. No vector database required. |
| **Product comparison** | `/ai/compare` — 2–4 products compared strictly from their real specs/price/rating data. |
| **Recommendations & similar products** | `/ai/recommendations`, `/ai/products/:id/similar` — pure content-based similarity (category/tag overlap + rating), no AI call needed for the candidate set. |
| **"Frequently bought together"** | `/ai/products/:id/bundle` — driven by real order co-purchase history (falls back to same-category products for a new catalog), Gemini only writes the cosmetic label. |
| **Review summarization** | `/ai/products/:id/review-summary` — refuses to summarize below 3 reviews and states the count it used. |
| **Admin description generator** | `/ai/admin/products/:id/generate-description` (admin-only) — writes to a `draftDescription` field only; a separate `/approve-description` call is required before it overwrites the live listing. |

### Core E-Commerce

JWT auth with OTP-gated signup and login 2FA — **no account is ever created in the database until its email OTP is verified** (registration details are held in a short-lived `PendingRegistration` until then); login accepts either an email or mobile number; forgot/reset-password reuses the same OTP infrastructure with an enumeration-safe response (identical whether or not the email exists). Also: cart, wishlist, saved addresses, product reviews with verified-purchase detection, coupons, full order lifecycle (PENDING → CONFIRMED → SHIPPED → DELIVERED, plus RETURN_REQUESTED/RETURNED/REFUNDED), Stripe Checkout with webhook-confirmed payment, admin product CRUD with Cloudinary image upload, admin order/return management, and an analytics dashboard (revenue trend, top products, low-stock alerts) built with `recharts`.

### Premium UI

Tailwind CSS v4 with a dark/light theme (persisted, toggle in the navbar), React Router, a real cart context (server-backed for logged-in users, merges a guest cart on login), skeleton loaders, toasts, and a lightweight product-comparison feature with a floating "Compare" bar.

### Multi-Vendor Marketplace

AURA PRO supports three roles — customer, seller, admin — through a `Seller` application/profile document attached to a customer's existing account, not a separate account system. Any logged-in customer can apply via a 5-step onboarding flow (`/sell`); an admin reviews and approves/rejects/requests more info (`/admin` → Sellers tab); an approved seller gets a full dashboard (`/seller`) for products, orders, analytics, and a per-sale commission ledger. Products/orders can freely mix platform-owned and seller-owned items — see **[docs/MARKETPLACE.md](docs/MARKETPLACE.md)** for the full lifecycle, the authorization model, and what's deliberately *not* implemented (no Stripe Connect / real payout rail, no automated GSTIN verification).

---

## Architecture

```
client/                         React 19 + Vite + Tailwind CSS v4
├── src/
│   ├── routes/AppRouter.jsx    Route table (admin dashboard is lazy-loaded)
│   ├── layouts/MainLayout.jsx  Navbar + Footer + Outlet + AI widget + Compare bar
│   ├── context/                Auth, Seller, Cart, Theme, Toast, Compare
│   ├── services/                One module per API resource (thin axios wrappers)
│   └── pages/                  Route-level components (incl. pages/admin/*, pages/seller/*, pages/sell/*)
└── vite.config.js

server/                         Node.js + Express (ESM)
├── app.js                      Middleware pipeline + route mounting
├── controllers/                Request handlers (thin — business logic in services/)
├── services/
│   ├── ai/                     client.js (Gemini wrapper) + one file per AI feature
│   ├── pricingService.js       Server-authoritative order total calculation (paise-based)
│   ├── inventoryService.js     Atomic stock reservation/restoration + low-stock alerts
│   ├── emailService.js         nodemailer wrapper (no-ops cleanly if SMTP unset)
│   ├── stripeClient.js         Shared Stripe client (null if unconfigured)
│   ├── otpService.js           OTP generation/hashing/verification (shared by signup, login 2FA, password reset)
│   ├── pendingRegistrationService.js  Holds registration details until OTP verification creates the real User
│   ├── sellerDocumentService.js  Cloudinary `authenticated` uploads + on-demand signed URLs
│   ├── sellerTransactionService.js  Commission ledger writes (Stripe webhook → SellerTransaction)
│   └── auditLogService.js      Append-only trail of sensitive admin actions
├── models/                     Mongoose schemas (incl. Seller, SellerTransaction, AuditLog)
├── validators/                 Zod request-validation schemas
├── middleware/                 auth, seller (requireApprovedSeller), validate, security, upload
└── tests/                      vitest + supertest + mongodb-memory-server
```

**Pricing model**: all money is stored as integer paise (`fooInPaise` fields) to avoid floating-point error; legacy decimal fields (`foo`) are kept in sync via Mongoose hooks for display convenience. Order totals are **always** recomputed server-side (`pricingService.calculateOrderTotal`) — the client only ever previews a total, never sets one.

**Checkout flow**: Cart → `/orders/preview` (server-computed total, coupon-aware) → `POST /orders` (creates a PENDING order, reserves stock) → `POST /orders/:id/pay` (creates a Stripe Checkout session for the order's real total) → Stripe-hosted payment → `POST /webhooks/stripe` (the *only* place that marks an order paid, confirmed, and triggers the confirmation email).

**Note on stock reservation**: stock is decremented at order-creation time (not at payment confirmation), so an abandoned PENDING order holds its reserved stock until an admin cancels it (which restores it) or the customer completes payment. There's no background job auto-releasing abandoned reservations — a documented simplification, not an oversight.

---

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

Copy the example files and fill in real values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

See [Environment Variables](#environment-variables) below for what each one does and which are optional.

### 3. Seed the database

```bash
cd server
node seeds/seedData.js                                   # 4 demo products + admin/customer accounts
node seeds/seedAdmin.js <email> <password>                # promote/create an additional admin
```

`seedData.js` **wipes** Products/Users/Wishlists/Addresses in the target database — only run it against a dev database.

Generate a payout encryption key (required before any seller submits bank details — see [docs/MARKETPLACE.md](docs/MARKETPLACE.md)):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the result as `PAYOUT_ENCRYPTION_KEY` in `server/.env`.

### 4. Run

```bash
# From the repo root, runs both server (:5000) and client (:5173):
npm run dev

# Or separately:
cd server && npm run dev
cd client && npm run dev
```

Health check: `http://localhost:5000/api/health`

### 5. (Optional) Test Stripe payments locally

The Stripe webhook needs a real endpoint to forward events to. Using the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:5000/api/v1/webhooks/stripe
```

Copy the webhook signing secret it prints into `server/.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Environment Variables

### Required for core functionality

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `CLIENT_URL` | Frontend origin, used for CORS and Stripe redirect URLs |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payments — get test keys at [dashboard.stripe.com](https://dashboard.stripe.com) |

### Optional — each degrades gracefully if unset

| Variable | Feature it unlocks | If unset |
| --- | --- | --- |
| `GEMINI_API_KEY` | All AI features (chat, search, recommendations, etc.) — pinned to free-tier Gemini Flash models, see [docs/AI.md](docs/AI.md); get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `/ai/*` endpoints return a clean 503; the rest of the app is unaffected |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Admin product image upload | Upload endpoint returns 503; products can still be created with externally-hosted image URLs |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` | Real order/status emails, and OTP delivery (signup verification, login 2FA, password reset) — see [docs/EMAIL.md](docs/EMAIL.md) for provider setup | Order emails are logged instead of sent; OTP codes show in a dev-only UI banner in non-production (never in production — see below) |
| `PAYOUT_ENCRYPTION_KEY` | Encrypts seller bank account/IFSC at rest (AES-256-GCM) — see [docs/MARKETPLACE.md](docs/MARKETPLACE.md) | Any endpoint that would store a seller's payout details fails closed with a 503 rather than storing anything insecurely |
| `MARKETPLACE_DEFAULT_COMMISSION_PERCENT` | Default commission percentage applied to seller sales (a per-seller override can be set directly on the `Seller` document) | Defaults to `0` if unset — sellers keep 100% of the ledgered (non-payout) amount |
| `ADMIN_SIGNUP_CODE` | The **only** way to create an admin account through the public API — registering with a matching `adminCode` field grants `admin` instead of `customer`, checked server-side with a constant-time comparison. Never guessable/settable by the client otherwise. Keep this secret. | Admin self-registration is disabled entirely; admins can still be created via `seeds/seedAdmin.js` |

Full list with defaults: [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). Email/OTP setup and testing: [docs/EMAIL.md](docs/EMAIL.md). Marketplace/seller setup: [docs/MARKETPLACE.md](docs/MARKETPLACE.md).

---

## Docker & Deployment

Both apps have production Dockerfiles and there's a root `docker-compose.yml` to run them together locally against production-style builds:

```bash
docker compose build
docker compose up
```

CI (`.github/workflows/ci.yml`) runs tests + lint + build + a Docker build check on every push/PR to `main`. For hosting options, environment-per-stage config, and a pre-launch checklist, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Testing

```bash
cd server && npm test   # vitest + supertest + mongodb-memory-server (spins up a real in-memory MongoDB, no external DB needed)
cd client && npm test   # vitest + @testing-library/react
```

Backend tests cover: server-authoritative pricing (GST, shipping thresholds, coupon caps), the full order-creation flow (stock reservation/rollback, auth gating), the Stripe webhook handler (mocked Stripe client — no live API calls), auth middleware, the AI graceful-degradation contract, and the full marketplace surface — seller onboarding/admin-review lifecycle (including illegal-status-transition rejection), payout-field encryption, cross-seller data isolation on products/orders, commission-ledger math, and ledger reversal on refund. They run with `GEMINI_API_KEY`/`STRIPE_SECRET_KEY`/SMTP/Cloudinary all intentionally unset, to exercise the fallback paths by default; `server/tests/aiClient.test.js` separately mocks the Gemini SDK to test the real request/response translation without a live key.

---

## Security

- JWT auth + role-based access control (`protect` / `adminOnly` / `optionalAuth` middleware)
- Server-side Zod validation on all mutating endpoints
- Rate limiting: general API, auth (10/hr), checkout (15/10min), and a dedicated AI limiter (30/15min) since AI calls are the costliest surface
- Helmet CSP, CORS allowlist, NoSQL-injection sanitization, HPP protection
- AI tool-use design means the model can only ever read data through server-executed, parameterized tools — it never runs arbitrary queries or sees secrets
- Stripe webhook signature verification; the webhook is the sole writer of `isPaid`/payment status
- No secrets are ever sent to the frontend (verified by scanning the production bundle)
- Seller bank details encrypted at rest (AES-256-GCM); only the last 4 digits of an account number are ever readable via the API
- Seller verification documents stored as Cloudinary `authenticated` assets with short-lived signed view URLs — never a standing public link
- Every seller-status change and user role/status change writes an `AuditLog` entry (`server/models/AuditLog.js`)
- A product/order can never carry a client-supplied `seller` id — Zod strips it from request bodies before the controller runs; it's always derived server-side from the authenticated seller

## Known Limitations

- Stock reservation has no auto-expiry for abandoned checkouts (see Architecture note above)
- Admin analytics recompute on every request (fine at this scale; would need caching/pre-aggregation at high order volume)
- **No real seller payout rail.** `SellerTransaction` is a bookkeeping ledger only — settling a seller's earnings to their bank account is a manual, off-platform process. Real automated payouts would need Stripe Connect (or equivalent) and are out of scope here.
- **No automated GSTIN/PAN verification.** Documents and tax IDs are stored for an admin to review manually; nothing in this app claims to have verified them against a government registry.
- One Stripe payment per order, not one per seller — a multi-seller cart is still a single charge to the platform; per-seller settlement happens via the commission ledger, not a split payment.
