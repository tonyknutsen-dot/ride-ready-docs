
-- Step 1: Add equipment_group column to check_library_items
ALTER TABLE public.check_library_items
  ADD COLUMN equipment_group text NOT NULL DEFAULT 'rides';

-- Step 2: Set all existing items to 'rides'
UPDATE public.check_library_items SET equipment_group = 'rides';

-- Step 3: Insert inflatable-specific check items
-- DAILY checks
INSERT INTO public.check_library_items (label, hint, frequency, equipment_group, risk_level, category, sort_index) VALUES
  ('Fabric condition and seams', 'Inspect all seams, panels and stitching for tears, abrasion or separation', 'daily', 'inflatables', 'high', 'Structure', 1),
  ('Anchor points and stakes', 'Check all anchor points are secure and stakes are fully driven in at correct angle', 'daily', 'inflatables', 'high', 'Anchorage', 2),
  ('Blower operation and airflow', 'Confirm blower starts correctly, runs smoothly, and maintains full inflation pressure', 'daily', 'inflatables', 'high', 'Blower', 3),
  ('Blower tube attachment', 'Ensure blower tube is securely fastened to inflatable with no air leaks', 'daily', 'inflatables', 'med', 'Blower', 4),
  ('Safety netting and containment', 'Check all netting is intact, correctly tensioned and properly attached', 'daily', 'inflatables', 'high', 'Safety', 5),
  ('Entry and exit points', 'Verify entry/exit areas are clear, padded and safe for users', 'daily', 'inflatables', 'med', 'Safety', 6),
  ('Ground surface suitability', 'Confirm ground is level, free of sharp objects and appropriate for inflation', 'daily', 'inflatables', 'med', 'Site', 7),
  ('Ground sheet and mat condition', 'Check ground sheet is laid correctly and mats are in position at entry/exit', 'daily', 'inflatables', 'low', 'Site', 8),
  ('Electrical connections and RCD', 'Verify all electrical connections are dry, secure and RCD protected', 'daily', 'inflatables', 'high', 'Electrical', 9),
  ('Cleanliness and hygiene', 'Inflatable surface is clean and free from debris, dirt or moisture', 'daily', 'inflatables', 'low', 'Hygiene', 10),
  ('Wind speed and weather suitability', 'Check wind conditions are within safe operating limits for this inflatable', 'daily', 'inflatables', 'high', 'Weather', 11),
  ('User capacity signage displayed', 'Confirm maximum user capacity and age/height restrictions are clearly displayed', 'daily', 'inflatables', 'med', 'Signage', 12),
  ('Surrounding clearance zone', 'Verify minimum clearance distances are maintained around the inflatable', 'daily', 'inflatables', 'med', 'Site', 13),

-- PRE-OPENING checks
  ('RPII / ADIPS / PIPA certificate valid', 'Confirm current inspection certificate is valid and on-site', 'preopening', 'inflatables', 'high', 'Compliance', 1),
  ('Operator briefing completed', 'All operators briefed on safety rules, capacity limits and emergency procedures', 'preopening', 'inflatables', 'high', 'Operations', 2),
  ('Weather forecast reviewed', 'Check forecast for wind speed, rain and conditions throughout operating period', 'preopening', 'inflatables', 'high', 'Weather', 3),
  ('Emergency procedures accessible', 'Confirm emergency deflation procedure is known and accessible to operators', 'preopening', 'inflatables', 'med', 'Safety', 4),
  ('First aid kit available', 'Verify first aid kit is stocked and accessible near the inflatable', 'preopening', 'inflatables', 'low', 'Safety', 5),
  ('Public liability insurance valid', 'Confirm current PLI certificate covers this equipment and is on-site', 'preopening', 'inflatables', 'high', 'Compliance', 6),

-- WEEKLY checks
  ('Deep fabric inspection', 'Thorough check of all fabric panels, seams and high-wear areas for damage', 'weekly', 'inflatables', 'high', 'Structure', 1),
  ('Blower motor and fan condition', 'Inspect blower motor, fan blades and housing for wear or damage', 'weekly', 'inflatables', 'med', 'Blower', 2),
  ('All anchor hardware condition', 'Check D-rings, buckles, straps and stake loops for corrosion or wear', 'weekly', 'inflatables', 'high', 'Anchorage', 3),
  ('Repair patches integrity', 'Inspect any previous repair patches for peeling, lifting or deterioration', 'weekly', 'inflatables', 'med', 'Structure', 4),
  ('Velcro and zip fasteners', 'Check all velcro, zips and closure mechanisms operate correctly', 'weekly', 'inflatables', 'low', 'Structure', 5),
  ('Step/platform condition', 'Inspect any steps, platforms or climbing walls for wear and stability', 'weekly', 'inflatables', 'med', 'Structure', 6),

-- MONTHLY checks
  ('Full deep clean', 'Complete deep clean of all inflatable surfaces with appropriate cleaning products', 'monthly', 'inflatables', 'low', 'Hygiene', 1),
  ('Blower PAT test check', 'Verify blower has current PAT test and electrical safety certification', 'monthly', 'inflatables', 'high', 'Electrical', 2),
  ('Anchor system full review', 'Comprehensive review of all anchorage systems, ground stakes and tie-down straps', 'monthly', 'inflatables', 'high', 'Anchorage', 3),
  ('Blower power cable condition', 'Full-length inspection of blower power cable for cuts, kinks or exposed wiring', 'monthly', 'inflatables', 'med', 'Electrical', 4),
  ('Storage condition check', 'If stored: check for damp, mould, rodent damage or compression marks', 'monthly', 'inflatables', 'med', 'Storage', 5),

-- YEARLY checks
  ('Annual RPII / ADIPS / PIPA inspection', 'Arrange and complete annual inspection by registered inspector', 'yearly', 'inflatables', 'high', 'Compliance', 1),
  ('Blower annual PAT test', 'Full PAT testing of all blowers and electrical equipment', 'yearly', 'inflatables', 'high', 'Electrical', 2),
  ('Public liability insurance renewal', 'Confirm PLI is renewed and covers all inflatables in operation', 'yearly', 'inflatables', 'high', 'Compliance', 3),
  ('Risk assessment annual review', 'Review and update risk assessments for all inflatable operations', 'yearly', 'inflatables', 'med', 'Compliance', 4),
  ('Full fabric and structure overhaul', 'Comprehensive professional inspection of fabric, stitching and structural integrity', 'yearly', 'inflatables', 'high', 'Structure', 5);
