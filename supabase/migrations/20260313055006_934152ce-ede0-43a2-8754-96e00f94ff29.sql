-- ═══════════════════════════════════════════════════════════
-- GAMES CHECK LIBRARY
-- equipment_group = 'games'
-- ═══════════════════════════════════════════════════════════

-- ── DAILY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('games', 'daily', 'Structure', 'Overall structural condition', 'Check frame, panels, counter, and fixings for damage', 1, true),
  ('games', 'daily', 'Structure', 'Stability and level footing', 'Confirm unit is stable, level, and not rocking', 2, true),
  ('games', 'daily', 'Structure', 'Counter and front barrier condition', 'Check player-facing surfaces are secure and undamaged', 3, true),
  ('games', 'daily', 'Structure', 'Targets, props, and display security', 'Check all game targets, props, and displays are fixed', 4, true),
  ('games', 'daily', 'Safety', 'Sharp edges and protrusions', 'Check for exposed screws, nails, or sharp edges', 5, true),
  ('games', 'daily', 'Safety', 'Trip hazards around player area', 'Check for cables, pegs, or items around the game', 6, true),
  ('games', 'daily', 'Safety', 'Projectile and impact hazards', 'Check backstops, guards, and containment where needed', 7, true),
  ('games', 'daily', 'Safety', 'Moving parts guarded where fitted', 'Check guards on any mechanical or moving elements', 8, true),
  ('games', 'daily', 'Electrical', 'Electrical connections where fitted', 'Check plugs, cables, and connections are safe and dry', 9, true),
  ('games', 'daily', 'Electrical', 'Lighting working where fitted', 'Confirm all lights and effects are functioning', 10, true),
  ('games', 'daily', 'Signage', 'Instructions, pricing, and signage', 'Check game rules, pricing, and notices are visible', 11, true),
  ('games', 'daily', 'Operations', 'Queue and public access area', 'Queue and playing areas clear and safe', 12, true),
  ('games', 'daily', 'Operations', 'General housekeeping and tidiness', 'Game area clean and tidy before opening', 13, true),
  ('games', 'daily', 'Weather', 'Weather protection and canopy', 'Check covers, canopies, or awnings are secure', 14, true);

-- ── PRE-OPENING checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('games', 'preopening', 'Structure', 'Frame and unit condition', 'Visually inspect frame, fixings, and panels', 1, true),
  ('games', 'preopening', 'Structure', 'Counter and barrier secure', 'All player-facing surfaces stable', 2, true),
  ('games', 'preopening', 'Structure', 'Targets and props secure', 'All game elements firmly fixed', 3, true),
  ('games', 'preopening', 'Safety', 'No sharp edges or protrusions', 'Nothing that could catch or injure players', 4, true),
  ('games', 'preopening', 'Safety', 'Trip and slip hazards cleared', 'Clear of cables, loose items, and wet patches', 5, true),
  ('games', 'preopening', 'Safety', 'Projectile containment in place', 'Backstops and guards checked where needed', 6, true),
  ('games', 'preopening', 'Safety', 'Moving parts guarded', 'All mechanical guards in place', 7, true),
  ('games', 'preopening', 'Electrical', 'Electrical supply safe', 'Cables routed safely, plugs dry, RCD fitted', 8, true),
  ('games', 'preopening', 'Electrical', 'Lighting and effects operational', 'All lights and sound effects working', 9, true),
  ('games', 'preopening', 'Signage', 'Signage visible and correct', 'Rules, pricing, and safety notices in place', 10, true),
  ('games', 'preopening', 'Operations', 'Playing area clear and safe', 'No obstructions in player or queue areas', 11, true),
  ('games', 'preopening', 'Weather', 'Canopy and weather protection', 'Covers secure for conditions', 12, true);

-- ── WEEKLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('games', 'weekly', 'Structure', 'Frame and fixing integrity', 'Check all bolts, screws, and joints are tight', 1, true),
  ('games', 'weekly', 'Structure', 'Targets, props, and game elements', 'Check for wear, looseness, or damage', 2, true),
  ('games', 'weekly', 'Structure', 'Canopy and roof condition', 'Check for tears, loose fixings, or water pooling', 3, true),
  ('games', 'weekly', 'Electrical', 'Cable and plug condition', 'Inspect all electrical leads for damage or wear', 4, true),
  ('games', 'weekly', 'Safety', 'Fire extinguisher condition', 'Check extinguisher is present, charged, and in date', 5, true),
  ('games', 'weekly', 'Operations', 'General cleanliness and upkeep', 'Clean surfaces, check for wear or damage', 6, true);

-- ── MONTHLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('games', 'monthly', 'Structure', 'Full structural inspection', 'Thorough check of frame, panels, counter, and all fixings', 1, true),
  ('games', 'monthly', 'Structure', 'Game mechanism and moving parts', 'Full check of any mechanical, hydraulic, or moving elements', 2, true),
  ('games', 'monthly', 'Electrical', 'Electrical system review', 'Full check of wiring, sockets, and PAT status', 3, true),
  ('games', 'monthly', 'Safety', 'Fire safety equipment check', 'Extinguisher condition, signage, and access', 4, true),
  ('games', 'monthly', 'Safety', 'Projectile and impact safety review', 'Full check of backstops, guards, and containment', 5, true),
  ('games', 'monthly', 'Weather', 'Weather protection review', 'Canopy, covers, and drainage in good order', 6, true),
  ('games', 'monthly', 'Operations', 'Public-facing condition review', 'Overall appearance, paint, signage, and tidiness', 7, true);

-- ── YEARLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('games', 'yearly', 'Structure', 'Annual structural review', 'Full inspection of frame, panels, counter, and roof', 1, true),
  ('games', 'yearly', 'Electrical', 'Annual electrical inspection', 'Full PAT test and wiring check', 2, true),
  ('games', 'yearly', 'Compliance', 'Public liability insurance valid', 'Confirm insurance is current and covers the game', 3, true),
  ('games', 'yearly', 'Compliance', 'Risk assessment annual review', 'Review and update risk assessment', 4, true),
  ('games', 'yearly', 'Safety', 'Fire safety equipment service', 'Extinguisher service, replacement, and signage review', 5, true);