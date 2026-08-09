import { getPayload } from 'payload'
import config from '@payload-config'
import sharp from 'sharp'

const PRODUCTS = [
  {
    name: 'Intro Call (First Steps)',
    duration: 30,
    price: 45,
    description:
      'A get-to-know-you session to understand your goals, current situation, and where we can help. Low price to make it easy to take the first step.',
  },
  {
    name: 'Budget & Debt Deep Dive',
    duration: 60,
    price: 139,
    description:
      'A focused working session on cash flow, spending, and a debt payoff plan — for when you already know the specific problem you want to tackle.',
  },
  {
    name: 'Full Financial Plan',
    duration: 90,
    price: 279,
    description:
      'The comprehensive offering: income, savings, investments, retirement, and a written plan you walk away with.',
  },
  {
    name: 'Annual Check-Up',
    duration: 45,
    price: 95,
    description:
      'A yearly review for returning clients to update the plan, check progress, and adjust for life changes.',
  },
] as const

// Triggered manually (not on every deploy) via:
//   curl -X POST https://<host>/api/seed-products -H "Authorization: Bearer $CRON_SECRET"
// Safe to re-run: existing products (matched by name) are left untouched.
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  const existingPlaceholder = await payload.find({
    collection: 'media',
    where: { alt: { equals: 'Product placeholder' } },
    limit: 1,
  })

  let placeholderId = existingPlaceholder.docs[0]?.id
  if (!placeholderId) {
    const buffer = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 226, g: 232, b: 240 } },
    })
      .png()
      .toBuffer()

    const created = await payload.create({
      collection: 'media',
      data: { alt: 'Product placeholder' },
      file: {
        data: buffer,
        mimetype: 'image/png',
        name: 'product-placeholder.png',
        size: buffer.length,
      },
    })
    placeholderId = created.id
  }

  const results: Array<{ name: string; status: 'created' | 'skipped' }> = []

  for (const product of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      where: { name: { equals: product.name } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      results.push({ name: product.name, status: 'skipped' })
      continue
    }

    await payload.create({
      collection: 'products',
      data: {
        name: product.name,
        duration: product.duration,
        price: product.price,
        description: product.description,
        photo: placeholderId,
      },
    })
    results.push({ name: product.name, status: 'created' })
  }

  return Response.json({ results })
}
