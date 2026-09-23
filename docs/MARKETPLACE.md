# Multi-Vendor Marketplace

AURA PRO supports three roles — **customer**, **seller**, and **admin** — without three separate account systems. A seller is not a different kind of `User`; it's a `Seller` profile/application document attached to an existing `User`, so anyone can apply to sell without losing their existing customer account, order history, or cart. `User.role` only ever distinguishes `customer` from platform `admin` — seller capability is checked separately (see [Authorization model](#authorization-model) below).

## Seller lifecycle

```
draft → submitted → under_review → approved
                  ↘ action_required ↗
                  ↘ rejected (can revise & resubmit → under_review)

approved ⇄ suspended
```

- **draft** — the applicant is filling out the 5-step form (`/sell/onboarding` in the app). Editable at any time.
- **submitted** — the applicant has submitted; the application is locked from further edits until an admin acts.
- **under_review** — an admin has picked it up.
- **action_required** — the admin needs more information; `actionRequiredNote` explains what, and the applicant can edit again.
- **approved** — the seller can now access `/api/v1/seller/*` operational endpoints (products, orders, analytics, transactions, reviews, store settings).
- **rejected** — `rejectionReason` explains why; the applicant can revise and an admin can move it back to `under_review`.
- **suspended** — an approved seller who has since been suspended; blocked from all seller-operational endpoints until reactivated (moved back to `approved`).

Only `approved`, non-`suspended` sellers can publish products or access seller-operational endpoints — enforced server-side by `requireApprovedSeller` (`server/middleware/sellerMiddleware.js`), never by anything client-supplied.

## Becoming a seller (self-service)

1. Log in as any customer.
2. `POST/PATCH /api/v1/seller/application/*` — account, business, verification documents, payout — each step is independently saveable; the first call auto-creates a `draft` `Seller` doc scoped to `req.user._id` (see `sellerController.getOrCreateDraft`). No new account is ever created.
3. `POST /api/v1/seller/application/submit` — validates all required fields are present, moves to `submitted`.
4. Track progress at `GET /api/v1/seller/application`, or in the app at `/sell/status`.

## Admin review

All under `/api/v1/admin/sellers` (admin-only):

- `GET /sellers?status=submitted` — filter the review queue.
- `GET /sellers/:id` — full application detail, including verification-document links.
- `GET /sellers/:id/documents/:docId/url` — mints a short-lived (5 min), signed Cloudinary URL to view one document. Documents are uploaded as Cloudinary `authenticated` assets (`server/services/sellerDocumentService.js`) — not public, not guessable, and no permanent viewable link is ever stored.
- `PATCH /sellers/:id/status` — `{ status, reason?, note? }`. Transitions are validated against a fixed legal-transition map (`adminSellerController.js`); illegal jumps (e.g. `draft` → `approved`) are rejected with a 400. `reason` is required to `reject`; `note` is required for `action_required`.

**No automated verification happens anywhere in this flow.** GSTIN, PAN, and uploaded documents are stored for an admin to review manually — nothing is ever auto-marked `verified: true`. Wiring in a real GSTIN-lookup API is a documented future integration, not something this build claims to do.

Every status change (and the two pre-existing user role/status admin endpoints) writes an `AuditLog` entry (`actor`, `action`, `target`, `metadata`, `createdAt`) — an append-only trail of sensitive admin actions, queryable directly against the `auditlogs` collection (no dedicated UI yet).

## Payout details

Sellers submit bank account number + IFSC once, during onboarding. The full values are encrypted at rest with AES-256-GCM (`server/utils/encryption.js`) using the `PAYOUT_ENCRYPTION_KEY` env secret; only the last 4 digits of the account number are ever stored in plaintext or returned by any API (`payout.accountLast4`). There is no way to read back the full account number or IFSC through the app — encryption here is one-way in practice (decrypt exists as a utility function but nothing currently calls it), by design.

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Set it as `PAYOUT_ENCRYPTION_KEY` in `server/.env`. **Without it, any endpoint that would encrypt a bank detail fails closed with a 503** rather than storing anything insecurely or silently skipping encryption.

## Multi-vendor checkout & the commission ledger

- `Product.seller` and `Order.orderItems[].seller` are nullable refs to `Seller` — `null` means platform-owned, exactly today's pre-marketplace behavior. A cart/order can freely mix platform and seller products.
- `orderItems[].seller` is stamped from the product at order-creation time (a snapshot, not a live lookup) so it survives a later product reassignment.
- Order-level fields (`status`, `isPaid`, Stripe payment data) stay order-wide — **there is one Stripe payment per order, not one per seller**. This app does not implement Stripe Connect or any split-payment rail; that would be required for real, automated seller payouts and is out of scope here.
- Per-item `fulfillmentStatus` lets each seller progress their own line items (`PENDING` → ... → `DELIVERED`/`CANCELLED`) independently of the order-wide `status`, without needing separate Order documents.
- On payment confirmation (the Stripe webhook), one `SellerTransaction` ledger entry is written per seller-owned order item: `grossAmountInPaise`, `commissionPercent` (the seller's own override, falling back to `MARKETPLACE_DEFAULT_COMMISSION_PERCENT`), `commissionAmountInPaise`, `netAmountInPaise`. **This is bookkeeping only — no money moves.** Settling a seller's net earnings to their bank account is a manual, off-platform process; nothing here claims to be a payout integration.
- If an admin refunds an order (`POST /orders/admin/:id/approve-return`), any `pending`/`available` `SellerTransaction` entries for that order are marked `reversed`. Entries already `paid_out` are left alone — reconciling a refund after manual settlement is an accounting step outside this app's scope.

## Seller-operational endpoints

All under `/api/v1/seller`, gated by `requireApprovedSeller`:

| Endpoint | Purpose |
| --- | --- |
| `GET/POST/PUT/DELETE /products`, `POST /products/:id/images` | Ownership-scoped product CRUD, reusing the same slug generation and Cloudinary upload pattern as admin product management |
| `GET /orders`, `GET /orders/:orderId` | Orders containing this seller's items — **items belonging to other sellers in the same order are filtered out server-side before the response is sent**, never just hidden client-side |
| `PATCH /orders/:orderId/items/:itemId/fulfillment` | Update one of your own line items' fulfillment status |
| `GET /analytics/overview` | Gross revenue, commission paid, net earnings, 30-day trend, top products — scoped to this seller only |
| `GET /transactions` | This seller's own `SellerTransaction` ledger |
| `GET /reviews` | Reviews on this seller's products (read-only) |
| `GET/PUT /store` | Store profile, pickup address, shipping preferences — editable any time once approved (unlike the onboarding steps, which lock after submission) |

## Authorization model

- `User.role` stays `enum: ['customer', 'admin']` — unchanged from before the marketplace feature. Admin accounts are only ever created via `seeds/seedAdmin.js` (promotes an existing account by phone number — see [FIREBASE_AUTH.md](FIREBASE_AUTH.md)); there is no client-selectable role anywhere, and no admin path via sign-in.
- Seller access is `Seller.status === 'approved'` (and not `'suspended'`), checked fresh from the database on every request by `requireApprovedSeller` — never inferred from a JWT claim or anything the client asserts.
- A product/order body can never smuggle a different `seller` id: `productValidators.createProductSchema`/`updateProductSchema` don't define a `seller` field, and Zod's default "strip unknown keys" behavior removes it before the controller ever sees it. The real `seller` is always taken from `req.seller._id`, set by the auth middleware.
