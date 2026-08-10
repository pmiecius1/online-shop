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
            <Link
              href="/products"
              className="not-prose inline-block rounded bg-black text-white px-6 py-3 text-sm font-medium"
            >
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
