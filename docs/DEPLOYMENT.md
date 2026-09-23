# Deployment Guide

This covers running AURA PRO in production: containers, CI, environment configuration, and hosting options. For local development without Docker, see the main [README](../README.md).

## Architecture recap

- **server/** — stateless Node/Express API. Any number of instances can run behind a load balancer; state lives entirely in MongoDB Atlas (and Stripe/Cloudinary/Gemini for their respective concerns). `app.set('trust proxy', 1)` is already set so rate limiting and IP logic work correctly behind a reverse proxy/load balancer.
- **client/** — a static single-page app after `vite build`. It can be hosted anywhere that serves static files (Vercel, Netlify, S3+CloudFront, or the included nginx Docker image) — it does not need to run on the same host as the server.

Because the client is static and the server is stateless, **this scales horizontally by just adding more instances** — no sticky sessions, no shared in-memory state.

## Environment-specific configuration

Both apps read all configuration from environment variables (see `server/.env.example` and `client/.env.example`) — nothing is hardcoded per environment. For staging vs. production, use separate `.env` files (or your host's environment-variable UI) with:

- Different `MONGO_URI` (separate databases — never point staging at prod data)
- Different `CLIENT_URL` / `VITE_API_URL` (matching each environment's actual domains)
- Different Stripe keys (test keys for staging, live keys for production) and a **separate webhook endpoint + secret per environment**
- `NODE_ENV=production` on the server in both staging and production (this enables error-detail masking in `errorMiddleware.js`; only real local dev should use `NODE_ENV=development`)

Never commit real `.env` files — only the `.env.example` templates are tracked.

## Running with Docker

Each app has its own multi-stage `Dockerfile` (non-root runtime user, container health checks) and there's a root `docker-compose.yml` for running both together locally against production-style builds:

```bash
cp server/.env.example server/.env   # fill in real values first
docker compose build
docker compose up
```

- Server: `http://localhost:5000`
- Client: `http://localhost:8080`

The client's env vars (`VITE_API_URL` and the four `VITE_FIREBASE_*`) are baked in at **build time** (Vite inlines them into the JS bundle — there's no runtime config for a static SPA). A build arg with no matching `ARG` line in `client/Dockerfile` is silently dropped by Docker, so all five must be passed explicitly:

```bash
docker build \
  --build-arg VITE_API_URL=https://api.yourdomain.com/api/v1 \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com \
  --build-arg VITE_FIREBASE_PROJECT_ID=your-project-id \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -t aura-pro-client ./client
```

Omitting the four `VITE_FIREBASE_*` args builds a client where `isFirebaseConfigured()` is always `false` and `/login` permanently shows "Sign-in unavailable" — since Firebase Phone Auth is the only sign-in method, this isn't an optional/degrades-gracefully feature for this Dockerfile path the way it is for `VITE_API_URL`.

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`:
1. **server** job — installs deps, runs the test suite (vitest + supertest + an in-memory MongoDB — no external DB or API keys needed)
2. **client** job — installs deps, lints, runs tests, builds
3. **docker-build** job — verifies both Dockerfiles actually build (catches Dockerfile drift, doesn't push anywhere)

No deployment step is wired up (no registry/host credentials are available here) — add a `deploy` job once you've picked a host, using that host's GitHub Action and secrets.

## Hosting options

Pick per-service; they don't need to be the same host.

**Server** (needs to run a long-lived Node process — Docker-friendly):
- Render, Railway, Fly.io — all support "deploy from Dockerfile" directly from a GitHub repo
- Any container host (AWS ECS/Fargate, Google Cloud Run, Azure Container Apps) using `server/Dockerfile`

**Client** (static files only):
- Vercel, Netlify, or Cloudflare Pages — point at `client/`, build command `npm run build`, output directory `dist`, set `VITE_API_URL` **and the four `VITE_FIREBASE_*` vars** as build-time env vars in their dashboard. Adding/changing them never affects an already-built deploy — trigger a new deployment afterward.
- Or serve the `client/Dockerfile` nginx image from any container host, same as the server — pass all five as `--build-arg`s (see above)

### Checklist for going live

1. Provision MongoDB Atlas for production, whitelist your server host's IP (or `0.0.0.0/0` if the host has dynamic egress IPs — tighten this once you know your host's IP range).
2. Set every required env var on the server host (see `server/.env.example`); leave AI/Cloudinary/Resend unset only if you're intentionally deferring those features — they degrade gracefully. `FIREBASE_PROJECT_ID`/`_CLIENT_EMAIL`/`_PRIVATE_KEY` (backend) and `VITE_FIREBASE_*` (frontend, build-time) are **required** — without them no one can sign in at all, since Firebase Phone Auth is the only sign-in method (see `docs/FIREBASE_AUTH.md`). `PAYOUT_ENCRYPTION_KEY` is the other exception that doesn't degrade gracefully for the feature it gates: if you're launching the seller marketplace, generate and set it before any seller reaches the payout step of onboarding, or that step fails closed with a 503 (by design — see `docs/MARKETPLACE.md`).
3. Set `VITE_API_URL` (and the four `VITE_FIREBASE_*` vars) to their real values when building the client — a build-time var that's missing produces a client that permanently shows "Sign-in unavailable" on `/login` with no error in the console, since `isFirebaseConfigured()` fails closed rather than throwing.
4. Create a **live-mode** Stripe webhook pointed at `https://your-api-domain/api/v1/webhooks/stripe`, and set its signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Update `CLIENT_URL` (and `ADMIN_URL` if different) on the server to your real client domain — this drives both CORS and Stripe checkout redirect URLs.
6. Sign in once through the live app with the phone number you want as your first admin, then run `node seeds/seedAdmin.js <phone-number>` against production to promote that account to admin.
7. Confirm `npm test` is green in CI before merging to `main`.
