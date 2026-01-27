-- Allow 'preopening' checks to be saved
-- The UI submits check_frequency='preopening' for the Pre-Opening Function Test.

ALTER TABLE public.checks
  DROP CONSTRAINT IF EXISTS valid_inspection_frequency;

ALTER TABLE public.checks
  ADD CONSTRAINT valid_inspection_frequency
  CHECK (
    check_frequency = ANY (
      ARRAY[
        'daily'::text,
        'weekly'::text,
        'monthly'::text,
        'yearly'::text,
        'custom'::text,
        'preopening'::text
      ]
    )
  );