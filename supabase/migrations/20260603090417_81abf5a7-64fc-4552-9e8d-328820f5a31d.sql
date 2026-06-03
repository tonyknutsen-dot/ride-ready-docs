UPDATE public.profiles
SET subscription_status = 'expired',
    subscription_plan = NULL,
    current_period_end = NULL,
    cancel_at_period_end = false,
    cancel_at = NULL,
    stripe_customer_id_encrypted = NULL,
    stripe_subscription_id_encrypted = NULL,
    pending_subscription_plan = NULL,
    pending_change_effective_date = NULL
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tonyknutsen2@gmail.com');