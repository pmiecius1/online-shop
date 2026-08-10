import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import { getStripe } from '@/utilities/getStripe'

// Orders are only ever written here, once Stripe has verified payment — never
// at checkout time. That keeps the Orders collection free of pending/abandoned
// checkout attempts; a row appearing in /admin means it was actually paid.
async function markOrderPaid(
  payload: Awaited<ReturnType<typeof getPayload>>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Idempotent: a session can be re-delivered (e.g. `completed` followed by
  // `async_payment_succeeded` for delayed payment methods) — don't double-write.
  const existing = await payload.find({
    collection: 'orders',
    where: { stripeCheckoutSessionId: { equals: session.id } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) return

  const productId = Number(session.metadata?.productId)
  const slotId = Number(session.metadata?.slotId)
  if (!productId || Number.isNaN(productId) || !slotId || Number.isNaN(slotId)) return

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined
  const customerEmail = session.customer_details?.email ?? undefined

  await payload.create({
    collection: 'orders',
    data: {
      product: productId,
      slot: slotId,
      status: 'paid',
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? 'eur',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      customerEmail,
    },
    overrideAccess: true,
  })
}

// Payment didn't go through (expired or a delayed payment method failed).
// Since no Order row was ever written for this session, there's nothing to
// mark failed/canceled — just release the slot hold that /api/checkout
// placed at checkout-session-creation time, using the productId/slotId Stripe
// echoes back in the session metadata.
async function releaseSlotHold(
  payload: Awaited<ReturnType<typeof getPayload>>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const slotId = Number(session.metadata?.slotId)
  if (!slotId || Number.isNaN(slotId)) return

  await payload.db.pool.query(
    `UPDATE slots SET booked_count = booked_count - 1 WHERE id = $1 AND booked_count > 0`,
    [slotId],
  )
}

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Stripe signs the exact raw request body, so it must be read as text
  // (not parsed as JSON) before verification.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, {
      status: 400,
    })
  }

  const payload = await getPayload({ config })

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      // For payment methods that settle instantly, `completed` already means paid.
      // Delayed payment methods (e.g. bank debits) fire `async_payment_*` instead.
      if (session.payment_status === 'paid') {
        await markOrderPaid(payload, session)
      }
      break
    }
    case 'checkout.session.async_payment_succeeded': {
      await markOrderPaid(payload, event.data.object)
      break
    }
    case 'checkout.session.async_payment_failed': {
      await releaseSlotHold(payload, event.data.object)
      break
    }
    case 'checkout.session.expired': {
      await releaseSlotHold(payload, event.data.object)
      break
    }
    default:
      break
  }

  return Response.json({ received: true })
}
