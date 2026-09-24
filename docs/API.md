# AURA PRO API Reference

Base URL: `http://localhost:5000/api/v1` (dev). All responses follow `{ statusCode, data, message, success }`. Auth: `Authorization: Bearer <token>`.

## Auth

Email/password and Google Sign-In — see [AUTHENTICATION.md](AUTHENTICATION.md) for the full account model, session strategy, and bot-protection design.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | Public (Turnstile) | `{ name, email, password, confirmPassword, acceptedTerms, turnstileToken? }` → `{ user, token }` |
| POST | `/auth/login` | Public (Turnstile) | `{ email, password, rememberMe?, turnstileToken? }` → `{ user, token }` — generic error on any failure (never reveals whether the email exists) |
| POST | `/auth/forgot-password` | Public (Turnstile) | `{ email, turnstileToken? }` — always the same generic response, regardless of whether the email exists |
| POST | `/auth/reset-password` | Public | `{ token, password, confirmPassword }` — single-use, 30-minute-expiry token from the reset email |
| POST | `/auth/google` | Public | `{ idToken }` — a Google Identity Services ID token, exchanged for `{ user, token }` |
| GET | `/auth/me` | User | |
| PATCH | `/auth/me` | User | `{ name?, phone? }` |
| POST | `/auth/me/avatar` | User | multipart `avatar` field → Cloudinary |
| POST | `/auth/me/link-google` | User | `{ idToken }` — links Google to the already-authenticated account |
| POST | `/auth/change-password` | User | `{ currentPassword, newPassword }` |

## Products
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/products` | Public | Query: `page, limit, search, category, brand, minPrice, maxPrice, minRating, sort` |
| GET | `/products/:slug` | Public | |
| POST | `/products` | Admin | Create |
| PUT | `/products/:id` | Admin | Update |
| DELETE | `/products/:id` | Admin | |
| POST | `/products/:id/images` | Admin | multipart `image` field → Cloudinary |

## Cart
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cart` | User | |
| POST | `/cart` | User | `{ productId, quantity }` — quantity is a **signed delta**; dropping to ≤0 removes the item |
| DELETE | `/cart/:productId` | User | |

## Orders
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/orders/preview` | User | Server-computed total, no order created |
| POST | `/orders` | User | Creates a PENDING order from the cart, reserves stock |
| GET | `/orders/myorders` | User | Paginated |
| GET | `/orders/:id` | User (owner) / Admin | |
| POST | `/orders/:id/pay` | User (owner) | Creates a Stripe Checkout session |
| POST | `/orders/:id/request-return` | User (owner) | Only within 7 days of `DELIVERED` |
| GET | `/orders/admin/all` | Admin | Query: `page, limit, status` |
| PATCH | `/orders/admin/:id/status` | Admin | `{ status, note?, trackingNumber? }` |
| POST | `/orders/admin/:id/approve-return` | Admin | Refunds via Stripe if paid, else just restocks |
| POST | `/webhooks/stripe` | Stripe (signed) | Raw body; the only writer of payment confirmation |

## Reviews
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/reviews/product/:productId` | Public | Paginated |
| POST | `/reviews` | User | `{ product, rating, title?, comment }`, one per user per product |
| DELETE | `/reviews/:id` | User (owner) / Admin | |

## Wishlist / Addresses
| Method | Path | Auth |
|---|---|---|
| GET, POST `/toggle` | `/wishlist` | User |
| GET, POST | `/addresses` | User |

## AI (`/ai`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/ai/health` | Public | `{ available: boolean }` |
| POST | `/ai/search` | Public | `{ query, page?, limit? }` |
| POST | `/ai/chat` | Optional | `{ messages: [{role, content}] }` — order lookups only work if authenticated |
| POST | `/ai/compare` | Public | `{ productIds: [2-4 ids] }` |
| GET | `/ai/products/:id/similar` | Public | |
| GET | `/ai/products/:id/bundle` | Public | |
| GET | `/ai/products/:id/review-summary` | Public | |
| POST | `/ai/recommendations` | Public | `{ recentlyViewedIds?, cartProductIds?, limit? }` |
| POST | `/ai/admin/products/:id/generate-description` | Admin | Writes a draft, does not publish |
| POST | `/ai/admin/products/:id/approve-description` | Admin | Publishes the draft |

## Admin
| Method | Path | Auth |
|---|---|---|
| GET | `/admin/analytics/overview` | Admin |
| GET | `/admin/products/low-stock` | Admin |

All AI endpoints are additionally rate-limited (30 req/15min per IP) via a dedicated limiter separate from the general API limiter.
