-- Family A — Inflatable Slides — specific operational items only
-- ride_category_id: 738d4cd8-2166-4ab4-a57e-6890b17de341 (Inflatable Slide)
-- equipment_group: 'inflatables', item_kind: 'operational', is_active: true

INSERT INTO public.check_library_items
  (equipment_group, ride_category_id, frequency, item_kind, label, hint, sort_index, is_active)
VALUES
  ('inflatables', '738d4cd8-2166-4ab4-a57e-6890b17de341', 'daily', 'operational',
   'Slide surface inspected',
   'Check the full slide bed for folds, wrinkles, and wet patches before opening.',
   10, true),

  ('inflatables', '738d4cd8-2166-4ab4-a57e-6890b17de341', 'daily', 'operational',
   'Top platform netting and walls intact',
   'Confirm no tears in netting or walls and that all attachment points are secure.',
   20, true),

  ('inflatables', '738d4cd8-2166-4ab4-a57e-6890b17de341', 'daily', 'operational',
   'Run-out and landing area clear and padded',
   'Landing zone must be free of obstacles, with padded surface in place at correct length.',
   30, true),

  ('inflatables', '738d4cd8-2166-4ab4-a57e-6890b17de341', 'weekly', 'operational',
   'Full slide spine seam inspection',
   'Visual and tactile check end-to-end along the slide spine. Log any lifting or open stitching.',
   10, true);