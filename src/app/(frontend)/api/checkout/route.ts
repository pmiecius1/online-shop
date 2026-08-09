import { getPayload } from 'payload'
import config from '@payload-config'
import { getServerSideURL } from '@/utilities/getURL'
import { getStripe } from '@/utilities/getStripe'

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })

  let productId: unknown
  let slotId: unknown
  try {
    const body = await request.json()
    productId = body?.productId
    slotId = body?.slotId
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof productId !== 'number' && typeof productId !== 'string') {
    return Response.json({ error: 'productId is required' }, { status: 400 })
  }
  if (typeof slotId !== 'number' && typeof slotId !== 'string') {
    return Response.json({ error: 'slotId is required' }, { status: 400 })
  }

  const product = await payload.findByID({
    collection: 'products',
    id: productId,
    overrideAccess: false,
    disableErrors: true,
  })

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  // Reserve the slot atomically: only succeeds if it still belongs to this
  // product and has room. This holds the slot for the duration of checkout —
  // released again by the webhook if payment fails or the session expires —
  // so two customers can't both pay for the last spot.
  const reserveResult = await payload.db.pool.query(
    `UPDATE slots
     SET booked_count = booked_count + 1
     WHERE id = $1 AND product_id = $2 AND booked_count < capacity
     RETURNING id`,
    [slotId, product.id],
  )

  if (reserveResult.rowCount === 0) {
    return Response.json({ error: 'This slot is no longer available' }, { status: 409 })
  }

  const releaseSlotHold = async (): Promise<void> => {
    await payload.db.pool.query(
      `UPDATE slots SET booked_count = booked_count - 1 WHERE id = $1 AND booked_count > 0`,
      [slotId],
    )
  }

  const serverURL = getServerSideURL()
  const stripe = getStripe()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${serverURL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${serverURL}/checkout/cancel`,
      metadata: {
        productId: String(product.id),
        slotId: String(slotId),
      },
    })

    await payload.create({
      collection: 'orders',
      data: {
        product: product.id,
        slot: Number(slotId),
        status: 'pending',
        amount: product.price,
        currency: 'eur',
        stripeCheckoutSessionId: session.id,
      },
      overrideAccess: true,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    // Stripe session creation or the Order write failed after we already
    // reserved the slot — release the hold so it isn't stuck unavailable.
    await releaseSlotHold()
    throw err
  }
}
