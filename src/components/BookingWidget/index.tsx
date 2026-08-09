'use client'

import React, { useEffect, useState } from 'react'

interface AvailableSlot {
  id: number
  startsAt: string
}

const formatSlot = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const BookingWidget: React.FC<{ productId: number }> = ({ productId }) => {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)

    fetch(`/api/products/${productId}/slots`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load available times.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId])

  const handleBook = async () => {
    if (!selectedSlotId) return
    setBookingLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, slotId: Number(selectedSlotId) }),
      })

      if (response.status === 409) {
        setError('That time was just booked by someone else. Please pick another.')
        setBookingLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Could not start checkout')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setBookingLoading(false)
    }
  }

  return (
    <div className="mt-3">
      {loadingSlots && <p className="text-sm text-muted-foreground">Loading available times…</p>}

      {!loadingSlots && slots && slots.length === 0 && (
        <p className="text-sm text-muted-foreground">No available times right now.</p>
      )}

      {!loadingSlots && slots && slots.length > 0 && (
        <select
          value={selectedSlotId}
          onChange={(e) => setSelectedSlotId(e.target.value)}
          className="w-full border rounded py-2 px-2 text-sm mb-2"
        >
          <option value="">Choose a time…</option>
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatSlot(slot.startsAt)}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={handleBook}
        disabled={bookingLoading || !selectedSlotId}
        className="w-full rounded bg-black text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {bookingLoading ? 'Redirecting…' : 'Book'}
      </button>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
