UPDATE profiles
SET subscription_status = 'past_due',
    subscription_plan = 'starter',
    current_period_end = now() + interval '7 days',
    stripe_customer_id = 'cus_test_pastdue'
WHERE user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';