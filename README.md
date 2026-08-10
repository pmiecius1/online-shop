# Online Shop

A booking site for a solo financial-coaching practice. Built with Next.js (App Router) and Payload CMS, using Stripe for payment and a Postgres database.

## What it sells

Four bookable service sessions (products), each with a name, description, duration, price (EUR), a photo, and a set of dates/slots with their own capacity:

1. **Intro Call (First Steps)** — 30 min, €45 — low-friction entry point for new clients.
2. **Budget & Debt Deep Dive** — 60 min, €139 — a focused session on cash flow and a debt payoff plan.
3. **Full Financial Plan** — 90 min, €279 — the premium offering, plus a written plan the client keeps.
4. **Annual Check-Up** — 45 min, €95 — a yearly review for returning clients.

A visitor picks a product and an available slot on `/products`, checks out via Stripe Checkout, and lands on `/checkout/success`, which shows the product they just bought once Stripe confirms the payment.

## How the owner edits content

The owner manages everything from the Payload admin panel at `/admin` (create the first admin user on first run). No code changes or redeploys are needed for day-to-day edits:

- **Products** — name, description, duration, price, and photo. Editing a product revalidates the public `/products` page on save, so the change appears live within moments.
- **Slots** — available dates and capacity per product.
- **Orders** — read-only list of paid orders (see below); the owner can see what's sold but can't create or edit rows here, since that would defeat the point of only trusting Stripe.
- **Pages / Posts / Header / Footer / Categories** — general site content, also revalidated live on save.

## How payment is verified

Checkout never marks anything as paid by itself. The flow is:

1. `/api/checkout` creates a Stripe Checkout Session and reserves the chosen slot — no order is written yet.
2. The customer pays on Stripe's hosted checkout page.
3. Stripe calls `/api/webhooks/stripe` with a signed event. The handler verifies the signature with `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent(...)` and rejects anything that doesn't verify.
4. Only once a verified `checkout.session.completed` (or `async_payment_succeeded`) event confirms `payment_status === 'paid'` is a row written to the `orders` collection, with `status: 'paid'`.
5. The `orders` collection's access control blocks `create`/`update` from any normal API caller — including a logged-in admin — so the webhook (using `overrideAccess: true`) is the *only* code path that can ever mark an order paid.
6. A declined, abandoned, or expired checkout never produces an order row at all; the reserved slot is released back to availability instead.

## Optional tasks completed

Both delivered on dedicated feature branches with their own pull requests:

- **Order confirmation page** (`feat/order-confirmation-page`, PR #14) — after a successful payment, `/checkout/success` retrieves the Stripe session and shows the product the customer bought (photo, name, price, duration, description) with a "Payment confirmed" message. It checks Stripe's session status directly (not our own `orders` table) to sidestep the race where the webhook hasn't finished writing the order yet.
- **Orders collection, written only via the verified webhook** (`fix/orders-only-on-paid-webhook`, PR #12) — paid orders are recorded in Payload so the owner can see them in `/admin`, and the row is written exclusively from the signature-verified Stripe webhook once payment is confirmed (see above).

## Running it locally

Requirements: Node 18+, pnpm, and a Postgres database.

1. `cp .env.example .env` and fill in the values (see table below).
2. `pnpm install`
3. `pnpm dev`
4. Open `http://localhost:3000` and `http://localhost:3000/admin` to create your first admin user.

### Environment variables

Set these in `.env` (never commit real values — `.env` is gitignored):

| Variable | What it's for | Where the value comes from |
|---|---|---|
| `DATABASE_URI` | Postgres connection string | A local Postgres instance (e.g. `postgresql://127.0.0.1:5432/online-shop`), or a hosted dev database (Supabase, Vercel Postgres, etc.) |
| `PAYLOAD_SECRET` | Encrypts Payload's auth/JWT tokens | Any long random string you generate yourself, e.g. `openssl rand -base64 32` |
| `NEXT_PUBLIC_SERVER_URL` | Used for CORS and building absolute links | `http://localhost:3000` locally; your deployed URL in production |
| `CRON_SECRET` | Authenticates Payload's scheduled-publish cron endpoint | Any random string you generate yourself |
| `PREVIEW_SECRET` | Authenticates draft-preview requests | Any random string you generate yourself |
| `STRIPE_SECRET_KEY` | Server-side Stripe API calls (creating Checkout Sessions) | Stripe Dashboard → Developers → API keys, **test mode** secret key (`sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js | Stripe Dashboard → Developers → API keys, **test mode** publishable key (`pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Verifies the Stripe webhook signature | Stripe Dashboard → Developers → Webhooks (or `stripe listen` CLI output for local dev), `whsec_...` |
| `BLOB_READ_WRITE_TOKEN` | Stores Payload media uploads on Vercel Blob | Vercel project → Storage → Blob store → generate a read/write token |

For local webhook testing, forward Stripe events to your dev server with the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This prints a `whsec_...` value to use as `STRIPE_WEBHOOK_SECRET` while developing.

### Tests

```bash
pnpm test:int   # integration tests (Vitest) — checkout, webhook signature/idempotency, order access control, products
pnpm test:e2e   # end-to-end tests (Playwright)
```

## Deployment

Production deploys run via GitHub Actions (`.github/workflows/deploy-production.yml`) when a PR into the `production` branch is merged, using Vercel. Never commit directly to `main`; changes go through a feature branch and pull request.
