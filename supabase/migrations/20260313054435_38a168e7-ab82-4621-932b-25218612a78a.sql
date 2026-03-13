-- ═══════════════════════════════════════════════════════════
-- ATTRACTIONS CHECK LIBRARY
-- equipment_group = 'attractions'
-- ═══════════════════════════════════════════════════════════

-- ── DAILY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('attractions', 'daily', 'Structure', 'Overall structural condition', 'Check frame, walls, panels, and fixings for damage', 1, true),
  ('attractions', 'daily', 'Structure', 'Floors, decks, and walkways', 'Check for damage, loose boards, or uneven surfaces', 2, true),
  ('attractions', 'daily', 'Structure', 'Stairs, ramps, and steps', 'Check treads, handrails, and non-slip surfaces', 3, true),
  ('attractions', 'daily', 'Safety', 'Barriers, guarding, and handrails', 'Check all barriers and rails are secure and undamaged', 4, true),
  ('attractions', 'daily', 'Safety', 'Slip and trip hazards', 'Check for loose cables, wet surfaces, or obstructions', 5, true),
  ('attractions', 'daily', 'Safety', 'Headroom and strike hazards', 'Check for low beams, props, or elements at head height', 6, true),
  ('attractions', 'daily', 'Safety', 'Emergency exits and escape routes', 'Confirm all exits are clear, unlocked, and signed', 7, true),
  ('attractions', 'daily', 'Electrical', 'Electrical connections where fitted', 'Check plugs, cables, and connections are safe', 8, true),
  ('attractions', 'daily', 'Electrical', 'Lighting and visibility', 'Confirm all lighting is working and walkways visible', 9, true),
  ('attractions', 'daily', 'Structure', 'Themed panels, props, and fixings', 'Check all decorative and themed elements are secure', 10, true),
  ('attractions', 'daily', 'Safety', 'Fire extinguisher accessible', 'Check extinguisher present, charged, and in date', 11, true),
  ('attractions', 'daily', 'Operations', 'Public access and egress routes', 'Confirm entry and exit routes are clear', 12, true),
  ('attractions', 'daily', 'Operations', 'General housekeeping and tidiness', 'Area clean and tidy before opening', 13, true);

-- ── PRE-OPENING checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('attractions', 'preopening', 'Structure', 'Frame and structural integrity', 'Visually inspect frame, joints, and panels', 1, true),
  ('attractions', 'preopening', 'Structure', 'Floor and walkway condition', 'Check all walking surfaces for hazards', 2, true),
  ('attractions', 'preopening', 'Structure', 'Stairs, ramps, and handrails', 'Check treads and rails are secure', 3, true),
  ('attractions', 'preopening', 'Safety', 'Barriers and guarding secure', 'All barriers, rails, and edge protection in place', 4, true),
  ('attractions', 'preopening', 'Safety', 'No trip or slip hazards', 'Clear of cables, loose items, and wet patches', 5, true),
  ('attractions', 'preopening', 'Safety', 'Headroom clearance checked', 'No low-hanging props or strike risks', 6, true),
  ('attractions', 'preopening', 'Safety', 'Emergency exits clear and signed', 'All exits accessible and illuminated', 7, true),
  ('attractions', 'preopening', 'Electrical', 'Electrical supply safe', 'Cables routed safely, plugs dry, RCD fitted', 8, true),
  ('attractions', 'preopening', 'Electrical', 'All lighting operational', 'Internal and external lighting working', 9, true),
  ('attractions', 'preopening', 'Structure', 'Props and themed elements secure', 'All decorative items firmly fixed', 10, true),
  ('attractions', 'preopening', 'Safety', 'Fire safety equipment in place', 'Extinguisher accessible and in date', 11, true),
  ('attractions', 'preopening', 'Weather', 'Weather effects on outdoor areas', 'Check for wind, rain, or ice affecting surfaces', 12, true);

-- ── WEEKLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('attractions', 'weekly', 'Structure', 'Structural fixings and joints', 'Check all bolts, screws, and connections are tight', 1, true),
  ('attractions', 'weekly', 'Structure', 'Floor and step wear', 'Check for wear, damage, or loose non-slip surfaces', 2, true),
  ('attractions', 'weekly', 'Safety', 'Barrier and handrail condition', 'Check for looseness, corrosion, or damage', 3, true),
  ('attractions', 'weekly', 'Structure', 'Themed elements and façade', 'Check painted surfaces, props, and signage for damage', 4, true),
  ('attractions', 'weekly', 'Electrical', 'Cable and plug condition', 'Inspect all electrical leads for damage or wear', 5, true),
  ('attractions', 'weekly', 'Safety', 'Fire extinguisher condition', 'Check extinguisher is present, charged, and in date', 6, true);

-- ── MONTHLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('attractions', 'monthly', 'Structure', 'Full structural inspection', 'Thorough check of frame, panels, floors, and fixings', 1, true),
  ('attractions', 'monthly', 'Structure', 'Stair, ramp, and platform review', 'Detailed check of all elevated surfaces and edges', 2, true),
  ('attractions', 'monthly', 'Safety', 'Emergency exit and escape route review', 'Full check of all exit routes, signage, and lighting', 3, true),
  ('attractions', 'monthly', 'Electrical', 'Electrical system review', 'Full check of wiring, sockets, and PAT status', 4, true),
  ('attractions', 'monthly', 'Safety', 'Fire safety equipment check', 'Extinguisher condition, signage, and access', 5, true),
  ('attractions', 'monthly', 'Structure', 'Themed elements and props review', 'Full condition check of all decorative and moving parts', 6, true),
  ('attractions', 'monthly', 'Operations', 'Public-facing condition review', 'Overall appearance, paint, signage, and tidiness', 7, true);

-- ── YEARLY checks ──

INSERT INTO check_library_items (equipment_group, frequency, category, label, hint, sort_index, is_active)
VALUES
  ('attractions', 'yearly', 'Structure', 'Annual structural review', 'Full inspection of frame, panels, floors, stairs, and roof', 1, true),
  ('attractions', 'yearly', 'Electrical', 'Annual electrical inspection', 'Full PAT test and wiring check', 2, true),
  ('attractions', 'yearly', 'Compliance', 'Public liability insurance valid', 'Confirm insurance is current and covers the attraction', 3, true),
  ('attractions', 'yearly', 'Compliance', 'Risk assessment annual review', 'Review and update risk assessment', 4, true),
  ('attractions', 'yearly', 'Safety', 'Fire safety equipment service', 'Extinguisher service, replacement, and signage review', 5, true),
  ('attractions', 'yearly', 'Safety', 'Emergency exit and escape route audit', 'Full review of all exits, signage, and emergency lighting', 6, true);