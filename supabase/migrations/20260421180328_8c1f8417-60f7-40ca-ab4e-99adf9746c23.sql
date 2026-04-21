ALTER TABLE public.checks DISABLE TRIGGER USER;
UPDATE public.checks SET is_test_data = false WHERE ride_id = '620d5cfb-7e10-4ca2-9df8-2f4d41ef5984';
ALTER TABLE public.checks ENABLE TRIGGER USER;

ALTER TABLE public.defects DISABLE TRIGGER USER;
UPDATE public.defects SET is_test_data = false WHERE ride_id = '620d5cfb-7e10-4ca2-9df8-2f4d41ef5984';
ALTER TABLE public.defects ENABLE TRIGGER USER;