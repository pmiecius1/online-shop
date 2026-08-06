import Stripe from 'stripe'

let stripe: Stripe | undefined

export const getStripe = (): Stripe => {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripe
}
