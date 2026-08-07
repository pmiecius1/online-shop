import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { POST } from '@/app/(frontend)/api/webhooks/stripe/route'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const testImagePath = path.resolve(dirname, '../fixtures/test-product.png')

let payload: Payload
let mediaId: number
let productId: number

const secret = process.env.STRIPE_WEBHOOK_SECRET

function signedRequest(body: unknown, overrideSecret = secret): Request {
  const raw = JSON.stringify(body)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHmac('sha256', overrideSecret ?? '')
    .update(`${timestamp}.${raw}`, 'utf8')
    .digest('hex')

  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body: raw,
  })
}

function checkoutSessionCompletedEvent(sessionOverrides: Record<string, unknown>) {
  return {
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_placeholder',
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_test_123',
        customer_details: { email: 'buyer@example.com' },
        metadata: {},
        amount_total: 1999,
        currency: 'eur',
        ...sessionOverrides,
      },
    },
  }
}

async function orderForSession(sessionId: string) {
  const result = await payload.find({
    collection: 'orders',
    where: { stripeCheckoutSessionId: { equals: sessionId } },
    limit: 1,
    overrideAccess: true,
  })
  return result.docs[0]
}

describe('Stripe webhook', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    expect(secret, 'STRIPE_WEBHOOK_SECRET must be set to run these tests').toBeTruthy()

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Test webhook product photo' },
      filePath: testImagePath,
    })
    mediaId = media.id

    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Webhook Test Product',
        price: 19.99,
        description: 'Product used to test the Stripe webhook.',
        photo: mediaId,
      },
      overrideAccess: true,
    })
    productId = product.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'orders',
      where: { stripeCheckoutSessionId: { like: 'cs_test_webhook_%' } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'products', id: productId, overrideAccess: true })
    await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  })

  it('rejects requests with no stripe-signature header', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects requests with an invalid signature', async () => {
    const req = signedRequest(
      checkoutSessionCompletedEvent({ id: 'cs_test_webhook_badsig' }),
      'wrong_secret',
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('marks a pending order paid on a validly signed checkout.session.completed event', async () => {
    const sessionId = 'cs_test_webhook_pending_to_paid'
    const order = await payload.create({
      collection: 'orders',
      data: {
        product: productId,
        status: 'pending',
        amount: 19.99,
        currency: 'eur',
        stripeCheckoutSessionId: sessionId,
      },
      overrideAccess: true,
    })

    const req = signedRequest(checkoutSessionCompletedEvent({ id: sessionId }))
    const res = await POST(req)
    expect(res.status).toBe(200)

    const updated = await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
    })
    expect(updated.status).toBe('paid')
    expect(updated.stripePaymentIntentId).toBe('pi_test_123')
    expect(updated.customerEmail).toBe('buyer@example.com')
  })

  it('is idempotent: replaying the same event does not error and stays paid', async () => {
    const sessionId = 'cs_test_webhook_idempotent'
    await payload.create({
      collection: 'orders',
      data: {
        product: productId,
        status: 'pending',
        amount: 19.99,
        currency: 'eur',
        stripeCheckoutSessionId: sessionId,
      },
      overrideAccess: true,
    })

    const event = checkoutSessionCompletedEvent({ id: sessionId })
    const firstRes = await POST(signedRequest(event))
    expect(firstRes.status).toBe(200)

    const secondRes = await POST(signedRequest(event))
    expect(secondRes.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order?.status).toBe('paid')
  })

  it('self-heals: creates a paid order from session metadata if no matching order exists', async () => {
    const sessionId = 'cs_test_webhook_no_matching_order'
    const req = signedRequest(
      checkoutSessionCompletedEvent({
        id: sessionId,
        metadata: { productId: String(productId) },
        amount_total: 1999,
      }),
    )
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeDefined()
    expect(order?.status).toBe('paid')
    expect(order?.amount).toBe(19.99)
  })

  it('does not mark an order paid when payment_status is not "paid"', async () => {
    const sessionId = 'cs_test_webhook_unpaid'
    const order = await payload.create({
      collection: 'orders',
      data: {
        product: productId,
        status: 'pending',
        amount: 19.99,
        currency: 'eur',
        stripeCheckoutSessionId: sessionId,
      },
      overrideAccess: true,
    })

    const req = signedRequest(
      checkoutSessionCompletedEvent({ id: sessionId, payment_status: 'unpaid' }),
    )
    const res = await POST(req)
    expect(res.status).toBe(200)

    const unchanged = await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
    })
    expect(unchanged.status).toBe('pending')
  })
})
