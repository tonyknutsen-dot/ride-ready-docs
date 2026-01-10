UPDATE public.profiles 
SET 
  subscription_status = NULL,
  subscription_plan = NULL,
  billing_cycle = NULL,
  stripe_subscription_id = NULL,
  current_period_end = NULL,
  extra_items_count = 0,
  updated_at = now()
WHERE user_id = '5cc28fea-8e0c-4941-ab03-3361ec889797';