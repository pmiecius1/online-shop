import type { Metadata } from 'next/types'

import Link from 'next/link'
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getStripe } from '@/utilities/getStripe'
import { Media } from '@/components/Media'

export const dynamic = 'force-dynamic'

type Args = {
  searchParams: Promise<{ session_id?: string }>
}

const GenericThankYou: React.FC = () => (
  <div className="pt-24 pb-24">
    <div className="container">
      <div className="prose dark:prose-invert max-w-none">
        <h1>Thank you!</h1>
        <p>Your order has been placed.</p>
        <p>
          <Link href="/products">Continue shopping</Link>
        </p>
      </div>
    </div>
  </div>
)

export default async function Page({ searchParams }: Args) {
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    return <GenericThankYou />
  }

  const stripe = getStripe()

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return <GenericThankYou />
  }

  // The webhook that records the paid Order may not have run yet — Stripe's
  // own session status is the immediate, reliable source of truth for
  // whether payment actually went through, independent of that race.
  if (session.payment_status !== 'paid') {
    return (
      <div className="pt-24 pb-24">
        <div className="container">
          <div className="prose dark:prose-invert max-w-none">
            <h1>Almost there…</h1>
            <p>We&apos;re still confirming your payment with Stripe. Check back in a moment.</p>
            <p>
              <Link href="/products">Continue shopping</Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const productId = Number(session.metadata?.productId)
  const payload = await getPayload({ config })
  const product =
    productId && !Number.isNaN(productId)
      ? await payload.findByID({
          collection: 'products',
          id: productId,
          disableErrors: true,
          overrideAccess: false,
        })
      : null

  const amount = (session.amount_total ?? 0) / 100
  const currency = (session.currency ?? 'eur').toUpperCase()

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Payment confirmed</h1>
          <p>Thanks — your order is paid and confirmed.</p>
        </div>

        {product ? (
          <div className="not-prose border rounded-lg overflow-hidden mt-6 max-w-md">
            <div className="relative aspect-square">
              <Media resource={product.photo} fill imgClassName="object-cover" />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <p className="text-base font-medium">
                {amount.toFixed(2)} {currency} · {product.duration} min
              </p>
              <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
            </div>
          </div>
        ) : (
          <p className="not-prose">
            Order total: {amount.toFixed(2)} {currency}
          </p>
        )}

        <div className="prose dark:prose-invert max-w-none mt-6">
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
    title: `Payment confirmed`,
  }
}
