ALTER TABLE public.user_submitted_check_items 
ADD COLUMN IF NOT EXISTS matched_library_item_id uuid REFERENCES public.check_library_items(id) ON DELETE SET NULL;