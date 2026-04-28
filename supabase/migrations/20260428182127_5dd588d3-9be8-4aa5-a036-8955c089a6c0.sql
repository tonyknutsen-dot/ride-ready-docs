insert into public.check_library_items
  (equipment_group, ride_category_id, frequency, item_kind, label, hint, risk_level, category, sort_index, is_active)
select v.equipment_group, null::uuid, v.frequency::public.check_frequency, 'operational', v.label, v.hint, v.risk_level, v.category, v.sort_index, true
from (values
  ('rides', 'weekly', 'Check emergency stop operation and reset', 'Confirm each emergency stop operates correctly and resets only when safe.', 'high', 'Controls', 100),
  ('rides', 'weekly', 'Inspect restraints, gates, and locking points', 'Check wear, adjustment, positive locking, and free movement.', 'high', 'Restraints', 110),
  ('rides', 'weekly', 'Check visible structure, welds, and fixings', 'Look for cracks, loose fixings, deformation, corrosion, or missing fasteners.', 'high', 'Structure', 120),
  ('rides', 'weekly', 'Inspect drive, braking, and transmission guards', 'Confirm guards are secure and drive/brake components show no unsafe wear.', 'high', 'Mechanical', 130),
  ('rides', 'weekly', 'Check electrical cables, plugs, and control labels', 'Look for damage, strain, overheating, water ingress, or missing labels.', 'med', 'Electrical', 140),
  ('rides', 'weekly', 'Inspect fencing, barriers, steps, and platforms', 'Confirm public separation, access/egress, steps, ramps, and platforms are secure.', 'med', 'Public Area', 150),
  ('rides', 'weekly', 'Check anchoring, packing, levelling, and ground contact', 'Confirm supports, packing, jacks, and ground contact remain stable.', 'high', 'Stability', 160),
  ('rides', 'weekly', 'Review signage, operator notices, and queue controls', 'Confirm safety notices and rider instructions are visible and appropriate.', 'med', 'Operations', 170),
  ('rides', 'weekly', 'Run controlled operating cycle and listen for abnormal noise', 'Operate through a controlled cycle and note any vibration, hesitation, or unusual noise.', 'high', 'Operation', 180),
  ('rides', 'weekly', 'Check fire extinguisher access and housekeeping', 'Confirm access is clear and operating areas are tidy and free of trip hazards.', 'med', 'Housekeeping', 190),
  ('inflatables', 'preopening', 'Confirm anchorage layout before inflation', 'Check anchors, stakes, ballast, straps, and attachment points before opening.', 'high', 'Anchorage', 200),
  ('inflatables', 'preopening', 'Check blower position, guards, and duct connection', 'Confirm blowers are secure, guarded, correctly connected, and clear of obstruction.', 'high', 'Blower', 210),
  ('inflatables', 'preopening', 'Inspect seams, bed, walls, and step areas', 'Look for tears, open seams, soft areas, damaged netting, or exposed hazards.', 'high', 'Fabric', 220),
  ('inflatables', 'preopening', 'Check pressure/firmness before public use', 'Confirm the unit is firm, stable, and recovering normally during test use.', 'high', 'Pressure', 230),
  ('inflatables', 'preopening', 'Confirm mats, entry, exit, and perimeter are clear', 'Check impact mats, entrance/exit route, queue line, and perimeter clearance.', 'med', 'Public Area', 240),
  ('inflatables', 'preopening', 'Check weather and wind reading before opening', 'Record local conditions and confirm operation remains within safe limits.', 'high', 'Weather', 250),
  ('inflatables', 'preopening', 'Confirm operator position and supervision arrangements', 'Check the operator can see the activity area and manage entry/exit safely.', 'med', 'Supervision', 260),
  ('inflatables', 'preopening', 'Check electrical supply and cable route', 'Confirm leads, plugs, RCD protection, and cable routing are safe and protected.', 'high', 'Electrical', 270)
) as v(equipment_group, frequency, label, hint, risk_level, category, sort_index)
where not exists (
  select 1
  from public.check_library_items cli
  where cli.equipment_group = v.equipment_group
    and cli.frequency = v.frequency::public.check_frequency
    and cli.item_kind = 'operational'
    and lower(trim(cli.label)) = lower(trim(v.label))
);