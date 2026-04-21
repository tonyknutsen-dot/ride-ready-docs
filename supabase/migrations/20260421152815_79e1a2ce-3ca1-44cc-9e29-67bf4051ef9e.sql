-- Link defects to the specific failed checklist item that triggered them.
-- Nullable to preserve historical/standalone defects; new defects raised from a failed item carry this link.
ALTER TABLE public.defects
  ADD COLUMN IF NOT EXISTS template_item_id uuid NULL REFERENCES public.daily_check_template_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_defects_check_item
  ON public.defects (check_id, template_item_id)
  WHERE template_item_id IS NOT NULL;