import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { preventDeleteIfReferenced } from './hooks/preventDeleteIfReferenced'

export const Slots: CollectionConfig = {
  slug: 'slots',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'startsAt',
    defaultColumns: ['product', 'startsAt', 'capacity', 'bookedCount'],
    description:
      'Bookable date/time slots for a product. bookedCount is managed automatically by checkout — a slot is held as soon as checkout starts and released again if payment fails or the session expires.',
  },
  hooks: {
    beforeDelete: [preventDeleteIfReferenced({ relationField: 'slot', label: 'slot' })],
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
    },
    {
      name: 'startsAt',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
    },
    {
      name: 'bookedCount',
      type: 'number',
      required: true,
      min: 0,
      defaultValue: 0,
      // Checkout writes this via a raw, capacity-guarded SQL UPDATE (see
      // /api/checkout and the webhook route), never through the Payload API —
      // so blocking API-level updates here can't break the booking flow, and
      // closes off desyncing availability by hand-editing it in the admin UI.
      access: {
        update: () => false,
      },
      admin: {
        readOnly: true,
        description: 'Managed automatically by checkout. Do not edit directly.',
      },
    },
  ],
}
