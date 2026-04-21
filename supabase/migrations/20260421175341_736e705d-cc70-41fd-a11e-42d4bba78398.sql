UPDATE public.profiles
SET subscription_status = 'trial',
    subscription_plan = 'operator',
    trial_started_at = now() - interval '1 day',
    trial_ends_at = now() + interval '14 days',
    company_name = COALESCE(company_name, 'QA Tester Co'),
    controller_name = COALESCE(controller_name, 'QA Tester')
WHERE user_id = '1ca20bd9-9cf2-445b-b08e-1dedc812646a';

INSERT INTO public.user_roles (user_id, role)
VALUES ('1ca20bd9-9cf2-445b-b08e-1dedc812646a', 'tester')
ON CONFLICT (user_id, role) DO UPDATE
SET expires_at = NULL;