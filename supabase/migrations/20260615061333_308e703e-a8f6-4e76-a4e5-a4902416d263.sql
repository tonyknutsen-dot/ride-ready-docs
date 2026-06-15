-- Stage 5: harden client exposure of Stripe identifiers.
-- Keep plaintext columns intact (required for webhook .eq() lookups, portal session
-- creation, check-subscription sync, and admin diagnostics via service-role edge
-- functions). Remove only the browser/PostgREST surface so ordinary client reads
-- (including select('*')) no longer return raw Stripe IDs.

REVOKE SELECT (stripe_customer_id, stripe_subscription_id, stripe_customer_id_encrypted, stripe_subscription_id_encrypted)
  ON public.profiles FROM anon, authenticated;

-- service_role retains full access; edge functions (stripe-webhook,
-- check-subscription, admin-stripe-data, customer-portal, checkout) use it.
GRANT SELECT ON public.profiles TO service_role;