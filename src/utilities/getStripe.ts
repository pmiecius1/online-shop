import Stripe from 'stripe'

let stripe: Stripe | undefined

export const getStripe = (): Stripe => {
  if (!stripe) {
    // Pinned so an SDK/dependency bump can't silently change the API version
    // this integration is built and tested against.
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-07-29.dahlia',
    })
  }
  return stripe
}
