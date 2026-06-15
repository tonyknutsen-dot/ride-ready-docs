-- Stage 5 fix: column-level GRANTs only work when there is no overriding
-- table-level SELECT grant. Revoke the broad SELECT and re-grant explicit
-- columns, omitting the four Stripe identifier columns.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, company_name, controller_name, address, showmen_name,
  created_at, updated_at, trial_started_at, trial_ends_at,
  subscription_status, subscription_plan, enable_document_versioning,
  app_mode, country, is_suspended, suspended_at, suspended_reason,
  operator_type, custom_terminology, billing_cycle, extra_items_count,
  current_period_end, company_logo_path, date_format, timezone,
  risk_settings, requires_operational_checks, cancel_at_period_end,
  cancel_at, pending_subscription_plan, pending_change_effective_date,
  last_billing_sync_at
) ON public.profiles TO authenticated;

-- service_role keeps unrestricted access for edge functions.
GRANT ALL ON public.profiles TO service_role;