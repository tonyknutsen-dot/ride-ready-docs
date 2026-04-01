-- Schedule automatic expiry of support access grants every 5 minutes
-- The expire_support_grants() function already exists and sets status='expired'
-- for grants where status='active' AND expires_at <= now()
SELECT cron.schedule(
  'expire-support-grants',
  '*/5 * * * *',
  $$SELECT public.expire_support_grants()$$
);