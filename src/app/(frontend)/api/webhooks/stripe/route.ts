import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import { getStripe } from '@/utilities/getStripe'

async function markOrderPaid(
  payload: Awaited<ReturnType<typeof getPayload>>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const existing = await payload.find({
    collection: 'orders',
    where: { stripeCheckoutSessionId: { equals: session.id } },
    limit: 1,
    overrideAccess: true,
  })

  const order = existing.docs[0]
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : undefined
  const customerEmail = session.customer_details?.email ?? undefined

  if (!order) {
    // No matching order — most likely /api/checkout's payload.create failed after the
    // Stripe session was already made (e.g. a DB hiccup). Since this webhook event is
    // itself the verified proof of payment, reconstruct the order from the session's
    // own metadata/amount rather than silently losing a paid order. The slot was
    // already reserved by /api/checkout before the session was created, so no
    // additional booked-count change is needed here.
    const productId = Number(session.metadata?.productId)
    const slotId = Number(session.metadata?.slotId)
    if (!productId || Number.isNaN(productId) || !slotId || Number.isNaN(slotId)) return

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
    return
  }

  // Idempotent: webhook retries or duplicate events must not re-process a settled order
  if (order.status === 'paid') return

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      status: 'paid',
      stripePaymentIntentId: paymentIntentId,
      customerEmail,
    },
    overrideAccess: true,
  })
}

async function markOrderFailed(
  payload: Awaited<ReturnType<typeof getPayload>>,
  session: Stripe.Checkout.Session,
  status: 'failed' | 'canceled',
): Promise<void> {
  const existing = await payload.find({
    collection: 'orders',
    where: { stripeCheckoutSessionId: { equals: session.id } },
    limit: 1,
    overrideAccess: true,
  })

  const order = existing.docs[0]
  // Idempotent: skip if already settled (paid) or already released (failed/canceled)
  if (!order || order.status === 'paid' || order.status === status) return

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { status },
    overrideAccess: true,
  })

  // Release the slot hold that /api/checkout placed at checkout-session-creation time.
  const slotId = typeof order.slot === 'object' ? order.slot.id : order.slot
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
      await markOrderFailed(payload, event.data.object, 'failed')
      break
    }
    case 'checkout.session.expired': {
      await markOrderFailed(payload, event.data.object, 'canceled')
      break
    }
    default:
      break
  }

  return Response.json({ received: true })
}
