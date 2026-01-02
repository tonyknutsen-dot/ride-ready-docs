-- Update skill-based games to be in 'Stalls' category group
UPDATE ride_categories 
SET category_group = 'Stalls' 
WHERE category_group = 'Games' 
AND name IN ('Coconut Shy', 'Darts', 'Hook-a-Duck', 'Hoopla', 'Ring Toss', 'Shooting Gallery', 'Test Your Strength', 'Tombola', 'Basketball Hoops');

-- Update coin-operated machines to remain in 'Games' category group (already correct)
-- Arcade Games and Penny Arcade stay as 'Games'

-- Add new coin-operated game categories
INSERT INTO ride_categories (name, description, category_group) VALUES
('Kiddie Rides', 'Small coin-operated ride-on machines for children', 'Games'),
('Simulators', 'Coin-operated motion simulators and driving games', 'Games'),
('Punch Bag', 'Coin-operated punch bag strength machines', 'Games'),
('Crane Game', 'Coin-operated claw/grabber machines', 'Games');