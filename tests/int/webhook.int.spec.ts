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

async function createSlot(capacity = 1, bookedCount = 1) {
  return payload.create({
    collection: 'slots',
    data: {
      product: productId,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      capacity,
      bookedCount,
    },
    overrideAccess: true,
  })
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
        duration: 30,
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
    await payload.delete({
      collection: 'slots',
      where: { product: { equals: productId } },
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

  it('creates a paid order from session metadata on a validly signed checkout.session.completed event', async () => {
    const sessionId = 'cs_test_webhook_creates_paid'
    const slot = await createSlot()

    const req = signedRequest(
      checkoutSessionCompletedEvent({
        id: sessionId,
        metadata: { productId: String(productId), slotId: String(slot.id) },
      }),
    )
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeDefined()
    expect(order?.status).toBe('paid')
    expect(order?.amount).toBe(19.99)
    expect(order?.stripePaymentIntentId).toBe('pi_test_123')
    expect(order?.customerEmail).toBe('buyer@example.com')

    // Paid orders keep the slot reservation — bookedCount is untouched
    const unchangedSlot = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(unchangedSlot.bookedCount).toBe(1)
  })

  it('is idempotent: replaying the same event does not create a duplicate order', async () => {
    const sessionId = 'cs_test_webhook_idempotent'
    const slot = await createSlot()

    const event = checkoutSessionCompletedEvent({
      id: sessionId,
      metadata: { productId: String(productId), slotId: String(slot.id) },
    })
    const firstRes = await POST(signedRequest(event))
    expect(firstRes.status).toBe(200)

    const secondRes = await POST(signedRequest(event))
    expect(secondRes.status).toBe(200)

    const orders = await payload.find({
      collection: 'orders',
      where: { stripeCheckoutSessionId: { equals: sessionId } },
      overrideAccess: true,
    })
    expect(orders.docs).toHaveLength(1)
    expect(orders.docs[0].status).toBe('paid')
  })

  it('does not create an order when payment_status is not "paid"', async () => {
    const sessionId = 'cs_test_webhook_unpaid'
    const slot = await createSlot()

    const req = signedRequest(
      checkoutSessionCompletedEvent({
        id: sessionId,
        payment_status: 'unpaid',
        metadata: { productId: String(productId), slotId: String(slot.id) },
      }),
    )
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeUndefined()
  })

  it('does not create an order when session metadata is missing productId/slotId', async () => {
    const sessionId = 'cs_test_webhook_no_metadata'

    const req = signedRequest(checkoutSessionCompletedEvent({ id: sessionId, metadata: {} }))
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeUndefined()
  })

  it('releases the slot hold when a checkout session expires, without creating an order', async () => {
    const sessionId = 'cs_test_webhook_expired'
    const slot = await createSlot(1, 1)

    const req = signedRequest({
      id: 'evt_test_expired',
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          metadata: { productId: String(productId), slotId: String(slot.id) },
        },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeUndefined()

    const releasedSlot = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(releasedSlot.bookedCount).toBe(0)
  })

  it('releases the slot hold when async payment fails, without creating an order', async () => {
    const sessionId = 'cs_test_webhook_async_failed'
    const slot = await createSlot(1, 1)

    const req = signedRequest({
      id: 'evt_test_async_failed',
      object: 'event',
      type: 'checkout.session.async_payment_failed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          metadata: { productId: String(productId), slotId: String(slot.id) },
        },
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const order = await orderForSession(sessionId)
    expect(order).toBeUndefined()

    const releasedSlot = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(releasedSlot.bookedCount).toBe(0)
  })

  it('does not release a slot below zero when an expiry event is replayed', async () => {
    const sessionId = 'cs_test_webhook_expired_idempotent'
    const slot = await createSlot(1, 1)

    const event = {
      id: 'evt_test_expired_replay',
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          metadata: { productId: String(productId), slotId: String(slot.id) },
        },
      },
    }
    await POST(signedRequest(event))
    await POST(signedRequest(event))

    // The `booked_count > 0` guard on the release query prevents going
    // negative even on a replayed event. Since no Order row is written for
    // unpaid sessions, this guard — not order-status tracking — is what
    // keeps a replay from releasing a slot twice.
    const releasedSlot = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(releasedSlot.bookedCount).toBe(0)
  })
})
