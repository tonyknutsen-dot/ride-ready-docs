-- Reset subscription data for testing
UPDATE profiles 
SET 
  subscription_status = 'trial',
  subscription_plan = NULL,
  billing_cycle = NULL,
  stripe_subscription_id = NULL,
  stripe_customer_id = NULL,
  current_period_end = NULL,
  extra_items_count = 0,
  trial_ends_at = NOW() + INTERVAL '14 days'
WHERE user_id = '5cc28fea-8e0c-4941-ab03-3361ec889797';