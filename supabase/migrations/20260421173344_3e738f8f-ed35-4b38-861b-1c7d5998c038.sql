UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id = '1ca20bd9-9cf2-445b-b08e-1dedc812646a';