import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    // Orders are only ever created or marked paid by trusted server code
    // (the checkout route and the verified Stripe webhook), both of which
    // use overrideAccess: true. No API caller — including a logged-in
    // admin via the admin UI — can create or mutate an order directly.
    create: () => false,
    read: authenticated,
    update: () => false,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'stripeCheckoutSessionId',
    defaultColumns: ['product', 'status', 'amount', 'currency', 'createdAt'],
    description:
      'Orders are created when checkout starts and marked paid only by a verified Stripe webhook event.',
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Canceled', value: 'canceled' },
      ],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Price charged, in the major currency unit (e.g. euros), at time of order.',
      },
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'eur',
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
    },
    {
      name: 'customerEmail',
      type: 'text',
    },
  ],
}
