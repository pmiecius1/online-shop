import { getPayload } from 'payload'
import config from '@payload-config'
import { getServerSideURL } from '@/utilities/getURL'
import { getStripe } from '@/utilities/getStripe'

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })

  let productId: unknown
  try {
    const body = await request.json()
    productId = body?.productId
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof productId !== 'number' && typeof productId !== 'string') {
    return Response.json({ error: 'productId is required' }, { status: 400 })
  }

  const product = await payload.findByID({
    collection: 'products',
    id: productId,
    overrideAccess: false,
  })

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  const serverURL = getServerSideURL()
  const stripe = getStripe()

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
    },
  })

  await payload.create({
    collection: 'orders',
    data: {
      product: product.id,
      status: 'pending',
      amount: product.price,
      currency: 'eur',
      stripeCheckoutSessionId: session.id,
    },
    overrideAccess: true,
  })

  return Response.json({ url: session.url })
}
