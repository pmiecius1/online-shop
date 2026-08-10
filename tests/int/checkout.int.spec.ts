// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { POST } from '@/app/(frontend)/api/checkout/route'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const testImagePath = path.resolve(dirname, '../fixtures/test-product.png')

let payload: Payload
let mediaId: number
let productId: number

function checkoutRequest(body: unknown): Request {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Checkout API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Test checkout product photo' },
      filePath: testImagePath,
    })
    mediaId = media.id

    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Checkout Test Product',
        duration: 30,
        price: 19.99,
        description: 'Product used to test the checkout route.',
        photo: mediaId,
      },
      overrideAccess: true,
    })
    productId = product.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'orders',
      where: { product: { equals: productId } },
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

  it('rejects a request with no productId', async () => {
    const res = await POST(checkoutRequest({ slotId: 1 }))
    expect(res.status).toBe(400)
  })

  it('rejects a request with no slotId', async () => {
    const res = await POST(checkoutRequest({ productId }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for a nonexistent product', async () => {
    const slot = await payload.create({
      collection: 'slots',
      data: {
        product: productId,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        bookedCount: 0,
      },
      overrideAccess: true,
    })

    const res = await POST(checkoutRequest({ productId: 999999999, slotId: slot.id }))
    expect(res.status).toBe(404)

    // No reservation should have been made against an unrelated product's slot
    const unchanged = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(unchanged.bookedCount).toBe(0)
  })

  it('returns 409 and does not double-book a slot that is already full', async () => {
    const slot = await payload.create({
      collection: 'slots',
      data: {
        product: productId,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        bookedCount: 1, // already full
      },
      overrideAccess: true,
    })

    const res = await POST(checkoutRequest({ productId, slotId: slot.id }))
    expect(res.status).toBe(409)

    const unchanged = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(unchanged.bookedCount).toBe(1)
  })

  it('returns 409 for a slot that belongs to a different product', async () => {
    const otherProduct = await payload.create({
      collection: 'products',
      data: {
        name: 'Other Checkout Test Product',
        duration: 30,
        price: 9.99,
        description: 'A second product to test slot/product mismatch.',
        photo: mediaId,
      },
      overrideAccess: true,
    })
    const slot = await payload.create({
      collection: 'slots',
      data: {
        product: otherProduct.id,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        bookedCount: 0,
      },
      overrideAccess: true,
    })

    const res = await POST(checkoutRequest({ productId, slotId: slot.id }))
    expect(res.status).toBe(409)

    await payload.delete({ collection: 'slots', id: slot.id, overrideAccess: true })
    await payload.delete({ collection: 'products', id: otherProduct.id, overrideAccess: true })
  })

  it('only allows one of two concurrent requests to reserve the last spot in a slot', async () => {
    const slot = await payload.create({
      collection: 'slots',
      data: {
        product: productId,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        bookedCount: 0,
      },
      overrideAccess: true,
    })

    // Both requests race for the single remaining spot. One should reserve it
    // (proceeding to call Stripe), the other must be rejected with 409 —
    // this is what makes the reservation safe against double-booking.
    const [resA, resB] = await Promise.all([
      POST(checkoutRequest({ productId, slotId: slot.id })),
      POST(checkoutRequest({ productId, slotId: slot.id })),
    ])

    const statuses = [resA.status, resB.status]
    expect(statuses).toContain(409)
    expect(statuses.filter((s) => s === 409)).toHaveLength(1)

    const finalSlot = await payload.findByID({
      collection: 'slots',
      id: slot.id,
      overrideAccess: true,
    })
    expect(finalSlot.bookedCount).toBe(1)
  })

  it('does not write an Order row when checkout starts (only the webhook does)', async () => {
    const slot = await payload.create({
      collection: 'slots',
      data: {
        product: productId,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
        bookedCount: 0,
      },
      overrideAccess: true,
    })

    const res = await POST(checkoutRequest({ productId, slotId: slot.id }))
    expect(res.status).toBe(200)

    const orders = await payload.find({
      collection: 'orders',
      where: { product: { equals: productId } },
      overrideAccess: true,
    })
    expect(orders.docs).toHaveLength(0)
  })
})
