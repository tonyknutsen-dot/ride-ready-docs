-- ═══════════════════════════════════════════════════════════
-- FOOD STALLS CHECK LIBRARY
-- equipment_group = 'food_stalls'
-- ═══════════════════════════════════════════════════════════

-- ── DAILY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('food_stalls', 'daily', 'Structure', 'Overall structural condition', 'Check frame, panels, counters, and fixings for damage', 1, true),
  ('food_stalls', 'daily', 'Structure', 'Stability and level footing', 'Confirm unit is stable, level, and not rocking', 2, true),
  ('food_stalls', 'daily', 'Structure', 'Counters and serving areas', 'Check serving surfaces are clean, secure, and undamaged', 3, true),
  ('food_stalls', 'daily', 'Hygiene', 'Cleanliness and hygiene', 'All food contact surfaces clean and sanitised', 4, true),
  ('food_stalls', 'daily', 'Hygiene', 'Handwash arrangements', 'Handwash station available with soap and clean water', 5, true),
  ('food_stalls', 'daily', 'Safety', 'Hot surfaces and burns risk', 'Guards, signage, and safe distance from public', 6, true),
  ('food_stalls', 'daily', 'Safety', 'Cooking equipment condition', 'Fryers, grills, hotplates working and safe', 7, true),
  ('food_stalls', 'daily', 'Gas', 'Gas / LPG hose and regulator', 'Check hoses, connections, and regulator for leaks or damage', 8, true),
  ('food_stalls', 'daily', 'Gas', 'Gas shut-off accessible', 'Confirm emergency gas shut-off is clear and reachable', 9, true),
  ('food_stalls', 'daily', 'Electrical', 'Electrical appliances and leads', 'Check plugs, cables, and appliances are safe and dry', 10, true),
  ('food_stalls', 'daily', 'Safety', 'Fire extinguisher and fire blanket', 'Check extinguisher and fire blanket present and accessible', 11, true),
  ('food_stalls', 'daily', 'Safety', 'Grease, oil, and spill hazards', 'Check for oil splashes, grease build-up, or spills', 12, true),
  ('food_stalls', 'daily', 'Operations', 'Ventilation and fume management', 'Ventilation clear and working where fitted', 13, true),
  ('food_stalls', 'daily', 'Operations', 'Waste handling and housekeeping', 'Waste bins available, area tidy, no obstructions', 14, true),
  ('food_stalls', 'daily', 'Operations', 'Public access and queue area', 'Queue and serving areas clear and safe', 15, true);

-- ── PRE-OPENING checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('food_stalls', 'preopening', 'Structure', 'Frame and unit condition', 'Visually inspect frame, panels, and fixings', 1, true),
  ('food_stalls', 'preopening', 'Structure', 'Counters and shelving secure', 'All surfaces and displays stable', 2, true),
  ('food_stalls', 'preopening', 'Hygiene', 'Food areas clean and sanitised', 'All prep and serving surfaces wiped down', 3, true),
  ('food_stalls', 'preopening', 'Hygiene', 'Handwash station ready', 'Soap, water, and drying available', 4, true),
  ('food_stalls', 'preopening', 'Safety', 'Hot surfaces guarded', 'Guards and signage in place before public arrive', 5, true),
  ('food_stalls', 'preopening', 'Safety', 'Cooking equipment checked', 'All appliances tested and working safely', 6, true),
  ('food_stalls', 'preopening', 'Gas', 'Gas connections and hoses checked', 'No leaks, kinks, or damage to gas supply', 7, true),
  ('food_stalls', 'preopening', 'Electrical', 'Electrical supply safe', 'Cables routed safely, plugs dry, RCD fitted', 8, true),
  ('food_stalls', 'preopening', 'Safety', 'Fire safety equipment in place', 'Extinguisher and fire blanket accessible', 9, true),
  ('food_stalls', 'preopening', 'Operations', 'Ventilation clear', 'Extraction and ventilation unobstructed', 10, true),
  ('food_stalls', 'preopening', 'Safety', 'Slip and spill hazards cleared', 'Floor clean and dry, mats in place', 11, true),
  ('food_stalls', 'preopening', 'Operations', 'Waste bins and housekeeping', 'Bins empty, area tidy for service', 12, true);

-- ── WEEKLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('food_stalls', 'weekly', 'Structure', 'Frame and fixing integrity', 'Check all bolts, screws, and joints are tight', 1, true),
  ('food_stalls', 'weekly', 'Hygiene', 'Deep clean of food areas', 'Thorough clean of all prep and cooking surfaces', 2, true),
  ('food_stalls', 'weekly', 'Gas', 'Gas system condition check', 'Inspect full gas run including bottle, regulator, and hoses', 3, true),
  ('food_stalls', 'weekly', 'Safety', 'Fire extinguisher condition', 'Check extinguisher and fire blanket are charged and in date', 4, true),
  ('food_stalls', 'weekly', 'Electrical', 'Cable and appliance condition', 'Inspect all electrical leads and appliances for wear', 5, true),
  ('food_stalls', 'weekly', 'Operations', 'Ventilation and extraction clean', 'Clean filters and check extraction is working', 6, true);

-- ── MONTHLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('food_stalls', 'monthly', 'Structure', 'Full structural inspection', 'Thorough check of frame, panels, floor, and roof', 1, true),
  ('food_stalls', 'monthly', 'Hygiene', 'Full hygiene review', 'Deep clean and condition check of all food areas', 2, true),
  ('food_stalls', 'monthly', 'Gas', 'Gas installation review', 'Full check of gas system, ventilation, and emergency shut-off', 3, true),
  ('food_stalls', 'monthly', 'Electrical', 'Electrical system review', 'Full check of wiring, sockets, and PAT status', 4, true),
  ('food_stalls', 'monthly', 'Safety', 'Fire safety equipment check', 'Extinguisher and fire blanket condition, signage, access', 5, true),
  ('food_stalls', 'monthly', 'Safety', 'Cooking equipment condition review', 'Full check of all cooking appliances and controls', 6, true),
  ('food_stalls', 'monthly', 'Operations', 'Public-facing condition review', 'Overall appearance, signage, and tidiness', 7, true);

-- ── YEARLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('food_stalls', 'yearly', 'Structure', 'Annual structural review', 'Full inspection of frame, panels, floor, and roof', 1, true),
  ('food_stalls', 'yearly', 'Electrical', 'Annual electrical inspection', 'Full PAT test and wiring check', 2, true),
  ('food_stalls', 'yearly', 'Gas', 'Gas safety certificate review', 'Confirm gas safety certificate is current', 3, true),
  ('food_stalls', 'yearly', 'Compliance', 'Public liability insurance valid', 'Confirm insurance is current and covers the unit', 4, true),
  ('food_stalls', 'yearly', 'Compliance', 'Risk assessment annual review', 'Review and update risk assessment', 5, true),
  ('food_stalls', 'yearly', 'Safety', 'Fire safety equipment service', 'Extinguisher and fire blanket service and replacement', 6, true);