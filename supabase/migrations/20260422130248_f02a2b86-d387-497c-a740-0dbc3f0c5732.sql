-- Family C — Combo Units — combo-specific operational items only
-- Combo Unit: 8f881899-b1b1-4a12-9389-834a398174df

INSERT INTO public.check_library_items
  (equipment_group, ride_category_id, frequency, item_kind, label, hint, sort_index, is_active)
VALUES
  ('inflatables', '8f881899-b1b1-4a12-9389-834a398174df', 'daily', 'operational',
   'Each section (bounce, slide, obstacle) inflated and inspected independently',
   'Walk every connected section in turn — confirm full inflation, no collapsed chambers, and no cross-section leaks.',
   10, true),

  ('inflatables', '8f881899-b1b1-4a12-9389-834a398174df', 'daily', 'operational',
   'Internal dividers and connecting tunnels secure and clear',
   'Check partitions between sections are upright, attachment points intact, and tunnels free of obstructions.',
   20, true),

  ('inflatables', '8f881899-b1b1-4a12-9389-834a398174df', 'weekly', 'operational',
   'Walk-through of every internal chamber and transition',
   'Enter and inspect each chamber and the transitions between them — look for hidden seam stress, rub points, or trapped debris.',
   10, true),

  ('inflatables', '8f881899-b1b1-4a12-9389-834a398174df', 'monthly', 'operational',
   'Stitching review on internal dividers and section partitions',
   'Combo units carry extra stitched load at every internal partition — inspect each one for lifting, fraying, or open thread.',
   10, true);