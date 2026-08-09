import type { Metadata } from 'next/types'

import { BookingWidget } from '@/components/BookingWidget'
import { Media } from '@/components/Media'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page() {
  const payload = await getPayload({ config: configPromise })

  const products = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 100,
    overrideAccess: false,
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none">
          <h1>Products</h1>
        </div>
      </div>

      <div className="container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.docs.map((product) => (
            <div key={product.id} className="border rounded-lg overflow-hidden">
              <div className="relative aspect-square">
                <Media resource={product.photo} fill imgClassName="object-cover" />
              </div>
              <div className="p-4">
                <h2 className="text-lg font-semibold">{product.name}</h2>
                <p className="text-base font-medium">
                  €{product.price.toFixed(2)} · {product.duration} min
                </p>
                <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
                <BookingWidget productId={product.id} />
              </div>
            </div>
          ))}
        </div>

        {products.docs.length === 0 && <p>No products yet.</p>}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Products`,
  }
}
