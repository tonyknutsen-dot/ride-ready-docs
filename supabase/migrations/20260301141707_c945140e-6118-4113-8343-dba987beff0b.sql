
-- 1) Add CHECK constraint on equipment_group
ALTER TABLE public.risk_library_items
  ADD CONSTRAINT risk_library_items_equipment_group_check
  CHECK (equipment_group IN ('general', 'rides', 'inflatables', 'games', 'food_stalls', 'stalls', 'attractions', 'equipment'));

-- 2) Also constrain equipment_group on user_submitted_risk_items
ALTER TABLE public.user_submitted_risk_items
  ADD CONSTRAINT user_submitted_risk_items_equipment_group_check
  CHECK (equipment_group IN ('general', 'rides', 'inflatables', 'games', 'food_stalls', 'stalls', 'attractions', 'equipment'));
