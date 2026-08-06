import type { Metadata } from 'next/types'

import Link from 'next/link'
import React from 'react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Thank you!</h1>
          <p>
            Your order has been placed. We&apos;ll confirm your payment as soon as we hear back
            from Stripe, and you&apos;ll receive an email receipt.
          </p>
          <p>
            <Link href="/products">Continue shopping</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Thank you`,
  }
}
