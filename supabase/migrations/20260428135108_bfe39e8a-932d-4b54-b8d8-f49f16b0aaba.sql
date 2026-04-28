insert into public.check_library_items
  (equipment_group, ride_category_id, frequency, item_kind, label, hint, risk_level, sort_index, is_active)
select
  'equipment',
  rc.id,
  'daily',
  'operational',
  v.label,
  v.hint,
  v.risk_level,
  v.sort_index,
  true
from public.ride_categories rc
cross join (values
  ('Generator output and supply condition', 'Check generator output, sockets, plugs, and supply points are sound and dry.', 'high', 10),
  ('Earthing and bonding arrangements', 'Confirm earthing/bonding arrangements are present and undamaged where required.', 'high', 20),
  ('Fuel containment and refuelling area', 'Check fuel storage, caps, spill containment, and refuelling area are safe.', 'high', 30),
  ('Exhaust routing and fume clearance', 'Confirm exhaust gases are routed safely away from operators, public, and enclosed areas.', 'high', 40),
  ('Cooling airflow and obstruction check', 'Check vents and cooling airflow are clear and the unit is not overheating.', 'med', 50),
  ('Emergency stop or isolation access', 'Confirm stop/isolation controls are accessible, labelled, and working where fitted.', 'high', 60),
  ('Cable protection from generator', 'Check outgoing cables are routed, protected, and not creating trip or damage risks.', 'med', 70),
  ('Generator running condition', 'Listen and observe for abnormal noise, vibration, smoke, warning lights, or unstable running.', 'med', 80)
) as v(label, hint, risk_level, sort_index)
where lower(rc.name) = 'generator'
and not exists (
  select 1
  from public.check_library_items cli
  where cli.ride_category_id = rc.id
    and cli.frequency = 'daily'
    and cli.item_kind = 'operational'
    and cli.label = v.label
);