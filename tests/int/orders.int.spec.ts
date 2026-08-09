import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import path from 'path'
import { fileURLToPath } from 'url'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const testImagePath = path.resolve(dirname, '../fixtures/test-product.png')

let payload: Payload
let mediaId: number
let productId: number
let slotId: number
let orderId: number

const orderData = () => ({
  product: productId,
  slot: slotId,
  status: 'pending' as const,
  amount: 19.99,
  currency: 'eur',
  stripeCheckoutSessionId: `cs_test_${Math.random().toString(36).slice(2)}`,
})

describe('Orders API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Test order product photo' },
      filePath: testImagePath,
    })
    mediaId = media.id

    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Order Test Product',
        duration: 30,
        price: 19.99,
        description: 'Product used to test Orders access control.',
        photo: mediaId,
      },
      overrideAccess: true,
    })
    productId = product.id

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
    slotId = slot.id

    const order = await payload.create({
      collection: 'orders',
      data: orderData(),
      overrideAccess: true,
    })
    orderId = order.id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'orders', id: orderId, overrideAccess: true })
    await payload.delete({ collection: 'slots', id: slotId, overrideAccess: true })
    await payload.delete({ collection: 'products', id: productId, overrideAccess: true })
    await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  })

  it('denies anonymous reads', async () => {
    await expect(
      payload.findByID({
        collection: 'orders',
        id: orderId,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('allows an authenticated user to read', async () => {
    const admin = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    const user = admin.docs[0]
    expect(user).toBeDefined()

    const result = await payload.findByID({
      collection: 'orders',
      id: orderId,
      overrideAccess: false,
      user,
    })
    expect(result.id).toBe(orderId)
  })

  it('denies anonymous creates', async () => {
    await expect(
      payload.create({
        collection: 'orders',
        data: orderData(),
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('denies creates even from an authenticated user (server-only via overrideAccess)', async () => {
    const admin = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    const user = admin.docs[0]

    await expect(
      payload.create({
        collection: 'orders',
        data: orderData(),
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow()
  })

  it('denies anonymous updates', async () => {
    await expect(
      payload.update({
        collection: 'orders',
        id: orderId,
        data: { status: 'paid' },
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('denies updates even from an authenticated user (server-only via overrideAccess)', async () => {
    const admin = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    const user = admin.docs[0]

    await expect(
      payload.update({
        collection: 'orders',
        id: orderId,
        data: { status: 'paid' },
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow()
  })

  it('denies anonymous deletes', async () => {
    await expect(
      payload.delete({
        collection: 'orders',
        id: orderId,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })
})
