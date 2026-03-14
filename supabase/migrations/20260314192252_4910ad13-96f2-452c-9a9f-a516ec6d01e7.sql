UPDATE profiles
SET current_period_end = now() - interval '1 day'
WHERE user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';