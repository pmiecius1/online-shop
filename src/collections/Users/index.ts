import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

// Scopes read/update/delete to the requesting user's own account. There's no
// `role` field (single-admin app today), so this is defense in depth: any
// account added later can't read, edit, or delete other users' records.
const self: Access = ({ req: { user }, id }) => {
  if (!user) return false
  if (id) return String(user.id) === String(id)
  return { id: { equals: user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: self,
    read: self,
    update: self,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
  timestamps: true,
}
