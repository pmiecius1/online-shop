# Homepage Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Payload CMS empty-state fallback currently shown at `/` with a real, hand-coded landing page (hero + value prop + single "Book a session" CTA to `/products`).

**Architecture:** `src/app/(frontend)/page.tsx` currently re-exports the CMS-driven `[slug]` template. Replace its contents with a plain server component, following the same shape as `src/app/(frontend)/products/page.tsx` (no CMS Pages lookup, own `generateMetadata`).

**Tech Stack:** Next.js App Router (server component), Tailwind (existing `container`/`prose` utility classes already used by `/products` and `/checkout/success`), no new dependencies.

---

### Task 1: Replace the homepage with a hand-coded hero + CTA

**Files:**
- Modify: `src/app/(frontend)/page.tsx` (currently 5 lines, re-exports `[slug]/page.tsx`'s `PageTemplate`)

No test file — this repo's coverage is API-route/collection-focused (`tests/int/*`); page components like `/products` and `/checkout/success` are verified by building and checking a preview deploy, not unit tests. This task follows that same convention (documented in the spec's Testing section).

- [ ] **Step 1: Read the current file to confirm the baseline**

Run: `cat "src/app/(frontend)/page.tsx"`
Expected output:
```tsx
import PageTemplate, { generateMetadata } from './[slug]/page'

export default PageTemplate

export { generateMetadata }
```

- [ ] **Step 2: Replace the file with the hand-coded homepage**

Write `src/app/(frontend)/page.tsx`:

```tsx
import type { Metadata } from 'next/types'

import Link from 'next/link'
import React from 'react'

export default function Page() {
  return (
    <div className="pt-32 pb-24">
      <div className="container">
        <div className="prose dark:prose-invert max-w-2xl">
          <h1 className="text-5xl">Financial coaching that fits your life</h1>
          <p className="text-lg">
            One-on-one sessions to help you get clear on your money — whether that&apos;s a
            single question you need answered or a full plan you want to walk away with. No
            jargon, no judgment, just a plan that works for you.
          </p>
          <p>
            <Link href="/products" className="not-prose inline-block rounded bg-black text-white px-6 py-3 text-sm font-medium">
              Book a session
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Nordleap — Financial coaching',
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0, no errors mentioning `page.tsx`

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds; the route table printed near the end shows `/` still listed (as `○` static or `ƒ` dynamic — either is fine, just confirm no build error against it)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/page.tsx"
git commit -m "$(cat <<'EOF'
Replace homepage CMS fallback with a real landing page

/ previously re-exported the [slug] CMS template and fell back to
Payload's generic empty-state copy (no "home" Page document exists).
Replaces it with a hand-coded hero + single CTA to /products, matching
how /products is already built (no CMS lookup).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open a PR**

```bash
git push -u origin feat/homepage-landing-page
gh pr create --base main --head feat/homepage-landing-page \
  --title "Add real homepage landing page" \
  --body "$(cat <<'EOF'
## Summary
- Replaces the generic Payload CMS empty-state fallback at \`/\` with a hand-coded hero + \"Book a session\" CTA to /products
- Spec: docs/superpowers/specs/2026-08-10-homepage-landing-page-design.md

## Test plan
- [x] \`npx tsc --noEmit\` passes
- [x] \`npm run build\` passes
- [ ] Merge to trigger Deploy Preview, confirm the homepage renders correctly on preview
EOF
)"
```

Expected: PR created successfully; a PR URL is printed.

---

## Post-plan verification (manual, after merge to preview)

- [ ] Load the preview deployment's root URL and confirm the hero renders (not the old "Payload Website Template" fallback)
- [ ] Click "Book a session" and confirm it navigates to `/products`
- [ ] Check the browser tab title reads "Nordleap — Financial coaching"
