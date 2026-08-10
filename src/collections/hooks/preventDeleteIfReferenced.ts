import type { CollectionBeforeDeleteHook } from 'payload'

import { APIError } from 'payload'

// Prevents deleting a document that's still referenced by an Order, since the
// `orders.product_id`/`orders.slot_id` foreign keys are ON DELETE SET NULL —
// without this guard, deleting a Product/Slot silently nulls out the
// reference on every past paid order, corrupting the financial record.
export const preventDeleteIfReferenced = ({
  relationField,
  label,
}: {
  relationField: 'product' | 'slot'
  label: string
}): CollectionBeforeDeleteHook => {
  return async ({ req, id }) => {
    const orders = await req.payload.find({
      collection: 'orders',
      where: { [relationField]: { equals: id } },
      limit: 1,
      depth: 0,
      req,
    })

    if (orders.docs.length > 0) {
      throw new APIError(
        `Cannot delete this ${label}: it is referenced by at least one existing order. Deleting it would corrupt order history.`,
        400,
      )
    }
  }
}
