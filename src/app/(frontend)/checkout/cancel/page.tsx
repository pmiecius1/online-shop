import type { Metadata } from 'next/types'

import Link from 'next/link'
import React from 'react'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Checkout canceled</h1>
          <p>Your card has not been charged.</p>
          <p>
            <Link href="/products">Back to products</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Checkout canceled`,
  }
}
