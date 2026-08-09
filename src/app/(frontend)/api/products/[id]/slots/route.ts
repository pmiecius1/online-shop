import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const payload = await getPayload({ config })

  const slots = await payload.find({
    collection: 'slots',
    where: {
      product: { equals: id },
      startsAt: { greater_than: new Date().toISOString() },
    },
    sort: 'startsAt',
    limit: 100,
    overrideAccess: false,
  })

  // bookedCount < capacity can't be expressed in Payload's query language
  // (it only compares fields to static values, not to each other), so
  // filter availability here instead.
  const available = slots.docs
    .filter((slot) => slot.bookedCount < slot.capacity)
    .map((slot) => ({ id: slot.id, startsAt: slot.startsAt }))

  return Response.json({ slots: available })
}
