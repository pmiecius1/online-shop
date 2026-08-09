## Project scope

This is a booking site for a solo financial-coaching practice, not a physical goods shop. There are exactly 4 products, all service sessions:

1. **Intro Call (First Steps)** — 30 min, €45. Entry point for new clients: understand goals, current situation, where help is needed. Priced low to reduce booking friction.
2. **Budget & Debt Deep Dive** — 60 min, €139. Focused working session on cash flow, spending, and a debt payoff plan, for clients who already know the specific problem to tackle.
3. **Full Financial Plan** — 90 min, €279. The premium offering: income, savings, investments, retirement, plus a written plan the client keeps.
4. **Annual Check-Up** — 45 min, €95. Yearly review for returning clients — update the plan, check progress, adjust for life changes. Recurring/repeat-booking product.

Each product is owner-editable in the admin panel with these fields:
- `title`
- `description`
- `duration` (minutes)
- `price` (EUR)
- available dates/slots, each with its own capacity

## Production rules

- Never commit directly to main. Make changes on a new branch and open a pull request for me to review.
- Never merge a pull request yourself. I will check the preview and merge it.
- Never run commands that could delete or overwrite the production database.
