UPDATE auth.users
SET encrypted_password = crypt('TesterPass2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id = '1ca20bd9-9cf2-445b-b08e-1dedc812646a';