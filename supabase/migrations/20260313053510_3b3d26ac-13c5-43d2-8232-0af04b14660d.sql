-- ═══════════════════════════════════════════════════════════
-- STALLS CHECK LIBRARY
-- equipment_group = 'stalls'
-- ═══════════════════════════════════════════════════════════

-- ── DAILY checks (core operational checks before opening) ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('stalls', 'daily', 'Structure', 'Overall structural condition', 'Check frame, joints, and panels for damage or movement', 1, true),
  ('stalls', 'daily', 'Structure', 'Stability and level footing', 'Confirm stall is stable, level, and not rocking', 2, true),
  ('stalls', 'daily', 'Structure', 'Counter and shelving security', 'Check counters, shelves, and displays are secure', 3, true),
  ('stalls', 'daily', 'Safety', 'Sharp edges and protrusions', 'Check for exposed screws, nails, or sharp edges', 4, true),
  ('stalls', 'daily', 'Safety', 'Trip hazards around stall', 'Check cables, pegs, and items around the stall', 5, true),
  ('stalls', 'daily', 'Safety', 'Floor and platform condition', 'Check flooring, steps, and platforms for damage or slip hazards', 6, true),
  ('stalls', 'daily', 'Electrical', 'Electrical connections where fitted', 'Check plugs, cables, and connections are safe and dry', 7, true),
  ('stalls', 'daily', 'Electrical', 'Lighting working where fitted', 'Confirm all lights are functioning', 8, true),
  ('stalls', 'daily', 'Signage', 'Signage and identification displayed', 'Check stall name, pricing, or notices are visible', 9, true),
  ('stalls', 'daily', 'Operations', 'General housekeeping and tidiness', 'Stall area clean and tidy before opening', 10, true),
  ('stalls', 'daily', 'Weather', 'Weather sheets and canopy condition', 'Check covers, canopies, or awnings are secure and undamaged', 11, true);

-- ── PRE-OPENING checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('stalls', 'preopening', 'Structure', 'Frame and joint condition', 'Visually inspect frame, fixings, and joints', 1, true),
  ('stalls', 'preopening', 'Structure', 'Stability and anchorage', 'Confirm stall is anchored, stable, and level', 2, true),
  ('stalls', 'preopening', 'Structure', 'Counter and display security', 'Check all surfaces and shelves are secure', 3, true),
  ('stalls', 'preopening', 'Safety', 'No sharp edges or protrusions', 'Check for anything that could catch or injure the public', 4, true),
  ('stalls', 'preopening', 'Safety', 'Floor and step condition', 'Check for trip, slip, or fall hazards', 5, true),
  ('stalls', 'preopening', 'Electrical', 'Electrical supply safe', 'Check cables routed safely, plugs dry, RCD fitted', 6, true),
  ('stalls', 'preopening', 'Electrical', 'Lighting operational', 'Confirm lights working before public arrive', 7, true),
  ('stalls', 'preopening', 'Signage', 'Signage visible and correct', 'Pricing, safety, and identification notices in place', 8, true),
  ('stalls', 'preopening', 'Operations', 'Access clear and tidy', 'No obstructions around public-facing areas', 9, true),
  ('stalls', 'preopening', 'Weather', 'Canopy and weather protection', 'Awnings and covers secure for conditions', 10, true),
  ('stalls', 'preopening', 'Safety', 'Fire extinguisher accessible', 'Check fire extinguisher present and in date where required', 11, true);

-- ── WEEKLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('stalls', 'weekly', 'Structure', 'Frame and fixing integrity', 'Check all bolts, screws, and joints are tight', 1, true),
  ('stalls', 'weekly', 'Structure', 'Roof and canopy condition', 'Check for tears, loose fixings, or water pooling', 2, true),
  ('stalls', 'weekly', 'Safety', 'Fire extinguisher condition', 'Check extinguisher is present, charged, and in date', 3, true),
  ('stalls', 'weekly', 'Electrical', 'Cable and plug condition', 'Inspect all electrical leads for damage or wear', 4, true),
  ('stalls', 'weekly', 'Operations', 'General cleanliness and upkeep', 'Clean surfaces, check for wear or damage', 5, true);

-- ── MONTHLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('stalls', 'monthly', 'Structure', 'Full structural inspection', 'Thorough check of frame, panels, and all fixings', 1, true),
  ('stalls', 'monthly', 'Structure', 'Anchorage and ballast review', 'Check anchoring method, weights, and ground fixings', 2, true),
  ('stalls', 'monthly', 'Electrical', 'Electrical system review', 'Full check of wiring, sockets, and PAT status', 3, true),
  ('stalls', 'monthly', 'Safety', 'Fire safety equipment check', 'Extinguisher condition, signage, and access', 4, true),
  ('stalls', 'monthly', 'Weather', 'Weather protection review', 'Canopy, covers, and drainage in good order', 5, true),
  ('stalls', 'monthly', 'Operations', 'Public-facing condition review', 'Overall appearance, paint, signage, and tidiness', 6, true);

-- ── YEARLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('stalls', 'yearly', 'Structure', 'Annual structural review', 'Full inspection of frame, panels, floor, and roof', 1, true),
  ('stalls', 'yearly', 'Electrical', 'Annual electrical inspection', 'Full PAT test and wiring check', 2, true),
  ('stalls', 'yearly', 'Compliance', 'Public liability insurance valid', 'Confirm insurance is current and covers the stall', 3, true),
  ('stalls', 'yearly', 'Compliance', 'Risk assessment annual review', 'Review and update risk assessment', 4, true),
  ('stalls', 'yearly', 'Safety', 'Fire safety equipment service', 'Extinguisher service, replacement, and signage review', 5, true);