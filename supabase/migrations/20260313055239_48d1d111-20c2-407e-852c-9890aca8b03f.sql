-- ═══════════════════════════════════════════════════════════
-- EQUIPMENT CHECK LIBRARY (support / operational equipment)
-- equipment_group = 'equipment'
-- ═══════════════════════════════════════════════════════════

-- ── DAILY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('equipment', 'daily', 'Structure', 'Overall condition and serviceability', 'Check unit for visible damage, wear, or faults', 1, true),
  ('equipment', 'daily', 'Structure', 'Stability and placement', 'Confirm unit is stable, level, and safely positioned', 2, true),
  ('equipment', 'daily', 'Structure', 'Guards, covers, and panels', 'Check all guards and covers are fitted and secure', 3, true),
  ('equipment', 'daily', 'Fuel', 'Fuel and oil levels where fitted', 'Check fuel, oil, and coolant levels', 4, true),
  ('equipment', 'daily', 'Fuel', 'Leaks and spills', 'Check for fuel, oil, or fluid leaks around the unit', 5, true),
  ('equipment', 'daily', 'Safety', 'Exhaust and ventilation', 'Exhaust clear and vented safely away from public', 6, true),
  ('equipment', 'daily', 'Electrical', 'Electrical connections and leads', 'Check plugs, cables, and connections are safe and dry', 7, true),
  ('equipment', 'daily', 'Electrical', 'Cable routing and trip hazards', 'Cables routed safely, covered, and away from walkways', 8, true),
  ('equipment', 'daily', 'Signage', 'Labels, ID plates, and warnings', 'Check identification and warning labels are visible', 9, true),
  ('equipment', 'daily', 'Safety', 'Fire risk and extinguisher provision', 'Check extinguisher present and accessible where needed', 10, true),
  ('equipment', 'daily', 'Operations', 'Access around equipment', 'Clear access for operation and emergency', 11, true),
  ('equipment', 'daily', 'Operations', 'General housekeeping', 'Area around equipment clean and tidy', 12, true);

-- ── PRE-OPENING checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('equipment', 'preopening', 'Structure', 'Unit condition and readiness', 'Visual check of unit before operation', 1, true),
  ('equipment', 'preopening', 'Structure', 'Guards and covers in place', 'All protective covers fitted before start-up', 2, true),
  ('equipment', 'preopening', 'Fuel', 'Fuel and fluid levels', 'Sufficient fuel, oil, and coolant for session', 3, true),
  ('equipment', 'preopening', 'Fuel', 'No leaks or spills', 'Check for leaks before starting', 4, true),
  ('equipment', 'preopening', 'Safety', 'Exhaust vented safely', 'Exhaust clear of public areas and enclosures', 5, true),
  ('equipment', 'preopening', 'Electrical', 'Electrical supply safe', 'Cables, plugs, and distribution checked', 6, true),
  ('equipment', 'preopening', 'Electrical', 'Cable routing safe', 'No trip hazards, cables protected', 7, true),
  ('equipment', 'preopening', 'Safety', 'Fire extinguisher accessible', 'Extinguisher present, charged, and in date', 8, true),
  ('equipment', 'preopening', 'Weather', 'Weather protection in place', 'Covers, enclosures, or shelters secure', 9, true),
  ('equipment', 'preopening', 'Operations', 'Access and clearance checked', 'Safe access and emergency clearance confirmed', 10, true);

-- ── WEEKLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('equipment', 'weekly', 'Structure', 'Fixings and mounting condition', 'Check all bolts, mounts, and connections tight', 1, true),
  ('equipment', 'weekly', 'Fuel', 'Fuel system and hose condition', 'Inspect fuel lines, caps, and connections', 2, true),
  ('equipment', 'weekly', 'Electrical', 'Cable and plug condition', 'Inspect all electrical leads for damage or wear', 3, true),
  ('equipment', 'weekly', 'Safety', 'Fire extinguisher condition', 'Check extinguisher is present, charged, and in date', 4, true),
  ('equipment', 'weekly', 'Operations', 'General cleanliness and upkeep', 'Clean unit and surrounding area', 5, true);

-- ── MONTHLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('equipment', 'monthly', 'Structure', 'Full condition inspection', 'Thorough check of unit, guards, panels, and fixings', 1, true),
  ('equipment', 'monthly', 'Fuel', 'Fuel system and filter review', 'Check fuel lines, filters, and connections', 2, true),
  ('equipment', 'monthly', 'Electrical', 'Electrical system review', 'Full check of wiring, distribution, and PAT status', 3, true),
  ('equipment', 'monthly', 'Safety', 'Exhaust and ventilation review', 'Check exhaust system, routing, and condition', 4, true),
  ('equipment', 'monthly', 'Safety', 'Fire safety equipment check', 'Extinguisher condition, signage, and access', 5, true),
  ('equipment', 'monthly', 'Operations', 'Operating condition review', 'Overall serviceability, performance, and maintenance needs', 6, true);

-- ── YEARLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('equipment', 'yearly', 'Structure', 'Annual condition review', 'Full inspection of unit, mountings, and all components', 1, true),
  ('equipment', 'yearly', 'Electrical', 'Annual electrical inspection', 'Full PAT test and wiring check', 2, true),
  ('equipment', 'yearly', 'Compliance', 'Public liability insurance valid', 'Confirm insurance covers the equipment', 3, true),
  ('equipment', 'yearly', 'Compliance', 'Risk assessment annual review', 'Review and update risk assessment', 4, true),
  ('equipment', 'yearly', 'Safety', 'Fire safety equipment service', 'Extinguisher service and replacement', 5, true),
  ('equipment', 'yearly', 'Fuel', 'Fuel system annual service', 'Full service of fuel system, filters, and hoses', 6, true);