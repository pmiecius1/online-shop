# Homepage landing page

## Problem

`/` currently delegates to the Payload CMS `[slug]` page template looking for a "home" Page document. None exists, so it falls back to Payload's generic empty-state copy ("Payload Website Template — Visit the admin dashboard..."). This is the first thing any visitor sees and does not represent the business at all.

## Goal

Convert first-time visitors into bookings. The homepage's only job is to say what this is and get the visitor to `/products` to pick a session.

## Approach

Minimal hand-coded page: hero headline, one short value-prop paragraph, one primary CTA button to `/products`. No product teaser, no testimonials/credibility section (none exist — not fabricating them), no CMS-driven content block system.

Rejected alternatives:
- **Live product teaser on the homepage** — pulls the 4 real products into a preview strip. More persuasive but adds scope; user chose to keep the homepage itself minimal and let `/products` be the one place that lists offerings.
- **Fuller marketing page** (how-it-works + testimonials) — testimonials don't exist yet; shipping an empty or fake section was rejected outright.
- **CMS-driven (Payload Pages collection)** — would let the copy be edited from `/admin` without a code change, at the cost of building out block types now. User chose hand-coded to match how `/products` already works (edit code, not `/admin`, to change copy).

## Content

- Business framing: solo financial-coaching practice (per `CLAUDE.md`), Stripe account name "Nordleap".
- Headline + one-paragraph value prop, written to reflect that framing — approachable, not corporate.
- CTA button label: "Book a session" → links to `/products`.

## Implementation

- `src/app/(frontend)/page.tsx` currently re-exports `[slug]/page.tsx`'s `PageTemplate` (the CMS-driven renderer). Replace it with a real component — same pattern as `src/app/(frontend)/products/page.tsx` (a plain server component, no CMS Pages lookup).
- Reuse existing visual language: `container`, `prose dark:prose-invert max-w-none`, `pt-24 pb-24` spacing, consistent with `/products` and `/checkout/success`. Hero section can use a larger heading size than those pages to read as a hero, but must stay within the same design system (no new component library, no new color tokens).
- `generateMetadata` sets an appropriate `<title>` for the homepage (currently inherited from the CMS template — needs its own).

## Testing

No dedicated test file. Consistent with existing coverage: `/products` and `/checkout/success` are also untested at the page level in this repo — coverage here is API-route/collection-focused (`tests/int/*`). Verify manually by loading the page after deploying to preview.

## Out of scope

- Editing this copy from `/admin` (would require the CMS-driven approach, explicitly rejected above)
- Product teaser / testimonials / how-it-works sections
- Changing anything about `/products` or other existing pages
