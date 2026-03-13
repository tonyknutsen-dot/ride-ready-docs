-- ═══════════════════════════════════════════════════════════
-- COORDINATED STALLS / GAMES CATEGORY CLEANUP (v2)
-- Handles unique constraint on ride_categories.name
-- ═══════════════════════════════════════════════════════════

-- ── STEP 1: Make ALL existing Games billable ──
UPDATE ride_categories SET is_billable = true WHERE category_group = 'Games';

-- ── STEP 2: Standardise Hook-A-Duck → Hook-a-Duck in Games ──
-- First delete the Stalls version so we can rename the Games version
DELETE FROM ride_categories WHERE category_group = 'Stalls' AND name = 'Hook-a-Duck';
UPDATE ride_categories SET name = 'Hook-a-Duck' WHERE category_group = 'Games' AND name = 'Hook-A-Duck';

-- ── STEP 3: Move game-style types from Stalls → Games by updating category_group ──
-- These names don't exist in Games yet, so just re-categorise them
UPDATE ride_categories SET category_group = 'Games' 
WHERE category_group = 'Stalls' AND name IN (
  'Coconut Shy', 'Darts', 'Hoopla', 'Ring Toss', 
  'Shooting Gallery', 'Test Your Strength', 'Tombola'
);

-- ── STEP 4: Delete remaining game-style duplicates from Stalls ──
-- Basketball Hoops (duplicate of Basketball Shootout in Games)
DELETE FROM ride_categories WHERE category_group = 'Stalls' AND name = 'Basketball Hoops';

-- ── STEP 5: Populate Stalls with true stall types ──
INSERT INTO ride_categories (category_group, name, is_billable, description)
VALUES
  ('Stalls', 'Sales Stall', true, 'Retail or merchandise sales stall'),
  ('Stalls', 'Prize Counter', true, 'Prize redemption or display counter'),
  ('Stalls', 'Ticket Booth', true, 'Ticket sales or pay booth'),
  ('Stalls', 'Display Stall', true, 'Display or promotional stall'),
  ('Stalls', 'Trailer Stall', true, 'Trailer-based sales or service unit'),
  ('Stalls', 'Merchandise Stall', true, 'Merchandise or souvenir stall');