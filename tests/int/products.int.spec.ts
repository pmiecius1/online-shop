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

const productData = {
  name: 'Test Product',
  duration: 30,
  price: 19.99,
  description: 'A short description of the test product.',
}

describe('Products API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Test product photo' },
      filePath: testImagePath,
    })
    mediaId = media.id

    const product = await payload.create({
      collection: 'products',
      data: { ...productData, photo: mediaId },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    productId = product.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'products',
      id: productId,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  })

  it('allows anonymous (logged-out) reads', async () => {
    const result = await payload.find({
      collection: 'products',
      where: { id: { equals: productId } },
      overrideAccess: false,
      user: undefined,
    })
    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].name).toBe(productData.name)
  })

  it('denies anonymous creates', async () => {
    await expect(
      payload.create({
        collection: 'products',
        data: { ...productData, photo: mediaId },
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('denies anonymous updates', async () => {
    await expect(
      payload.update({
        collection: 'products',
        id: productId,
        data: { price: 1 },
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('denies anonymous deletes', async () => {
    await expect(
      payload.delete({
        collection: 'products',
        id: productId,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it('allows an authenticated user to create, update, and delete', async () => {
    const admin = await payload.find({
      collection: 'users',
      limit: 1,
      overrideAccess: true,
    })
    const user = admin.docs[0]
    expect(user).toBeDefined()

    const created = await payload.create({
      collection: 'products',
      data: { ...productData, name: 'Authenticated Product', photo: mediaId },
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
    })
    expect(created.name).toBe('Authenticated Product')

    const updated = await payload.update({
      collection: 'products',
      id: created.id,
      data: { price: 25 },
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
    })
    expect(updated.price).toBe(25)

    await payload.delete({
      collection: 'products',
      id: created.id,
      overrideAccess: false,
      user,
      context: { disableRevalidate: true },
    })
  })

  it('requires name, duration, price, description, and photo', async () => {
    await expect(
      payload.create({
        collection: 'products',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {} as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
