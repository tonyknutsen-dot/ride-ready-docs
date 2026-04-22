-- Family B — Bounce / Castle Units — specific operational items only
-- Bouncy Castle:   3933a1dc-7a9e-42ff-9b7e-17b0e7b5db59
-- Jumping Castle:  6eed57f2-86a8-40ff-bbed-a822abc70bb6

INSERT INTO public.check_library_items
  (equipment_group, ride_category_id, frequency, item_kind, label, hint, sort_index, is_active)
VALUES
  ('inflatables', '3933a1dc-7a9e-42ff-9b7e-17b0e7b5db59', 'daily', 'operational',
   'Internal jumping surface free of foreign objects',
   'Sweep the interior and remove any debris, jewellery, or footwear residue before opening.',
   10, true),

  ('inflatables', '3933a1dc-7a9e-42ff-9b7e-17b0e7b5db59', 'daily', 'operational',
   'Front wall and spectator netting intact',
   'Confirm no tears, all attachment points secure, and visibility into the unit is unobstructed.',
   20, true),

  ('inflatables', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'daily', 'operational',
   'Internal jumping surface free of foreign objects',
   'Sweep the interior and remove any debris, jewellery, or footwear residue before opening.',
   10, true),

  ('inflatables', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'daily', 'operational',
   'Front wall and spectator netting intact',
   'Confirm no tears, all attachment points secure, and visibility into the unit is unobstructed.',
   20, true);