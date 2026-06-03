Confirmed from the current project context:

1. The Supabase project used by the app is `sbtldudgiskqfqqkrmaa`.
2. The live billing flow calls the Supabase Edge Function `create-checkout` via `supabase.functions.invoke('create-checkout')`.
3. That exact function reads `STRIPE_SECRET_KEY` from Supabase Edge Function runtime secrets using `Deno.env.get('STRIPE_SECRET_KEY')`.
4. The recent runtime logs prove the failing live request is reaching this same `create-checkout` function, but the runtime currently reports `keyMode: "test"` and account `acct_1RviE3AG8uIRefcZ`, so the secret available to the function runtime is not the intended live Knuts Software Ltd key.

Plan:

1. Trigger a secure update for the Supabase Edge Function runtime secret named exactly `STRIPE_SECRET_KEY`.
   - This will not update the Lovable Stripe MCP/tool connection.
   - The key value will not be exposed in chat or logs.

2. After you paste the new live key, force the `create-checkout` runtime to pick it up.
   - Redeploy/restart only the existing `create-checkout` Edge Function runtime if needed.
   - No changes to Stripe products, prices, webhooks, promo codes, trial logic, billing page code, or price IDs.

3. Run diagnostics from the actual Supabase `create-checkout` runtime, not the Stripe MCP connection.
   - Confirm the key mode is live only, without logging the key.
   - Confirm Stripe account retrieval returns the live Knuts Software Ltd account.
   - Confirm `stripe.prices.retrieve("price_1TSaveAsl8xleyvDADCNwAr5")` succeeds from that runtime.
   - Confirm checkout session creation succeeds through the same runtime and returns a live Checkout session ID/URL beginning with `cs_live_` / live Stripe Checkout URL.

4. Verify the frontend path.
   - Confirm the live billing button receives a checkout URL from `create-checkout`.
   - Confirm the app redirects/open Stripe Checkout instead of showing “Failed to process request.”

Nothing else will be changed.