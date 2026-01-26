-- Add ride-specific pre-opening check items for key ride categories

-- Chair-o-Plane (a5ba73d2-babd-4033-a4a4-58395056a62f)
INSERT INTO check_library_items (frequency, ride_category_id, label, hint, risk_level, sort_index, is_active) VALUES
('preopening', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'Chain/cable condition and attachment', 'Check all chains or cables for wear, kinks, and secure attachment points', 'high', 100, true),
('preopening', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'Seat suspension pivots and bearings', 'Ensure smooth movement and no excessive play in seat mounts', 'high', 101, true),
('preopening', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'Swing arm rotation free of obstruction', 'Confirm full rotation cycle without catching or binding', 'med', 102, true),
('preopening', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'Lap bar/restraint engagement test', 'Verify each lap bar locks securely and releases cleanly', 'high', 103, true),
('preopening', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'Speed governor function', 'Test speed limiting mechanism at maximum swing', 'high', 104, true);

-- Carousel (2db8c089-d30c-442d-b4c2-6297bc6d6615)
INSERT INTO check_library_items (frequency, ride_category_id, label, hint, risk_level, sort_index, is_active) VALUES
('preopening', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'Platform rotation smooth', 'Check for any binding, grinding or uneven rotation', 'med', 100, true),
('preopening', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'Horse/animal mounts secure', 'Test all figures are firmly attached to platform and poles', 'high', 101, true),
('preopening', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'Pole sliding mechanism (if galloping)', 'Verify up/down movement is smooth without sticking', 'med', 102, true),
('preopening', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'Decorative elements secure', 'Check mirrors, lights, and artwork are firmly attached', 'low', 103, true),
('preopening', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'Platform edge safety', 'Ensure no gaps or trip hazards at platform edge', 'med', 104, true);

-- Dodgems (e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff)
INSERT INTO check_library_items (frequency, ride_category_id, label, hint, risk_level, sort_index, is_active) VALUES
('preopening', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Floor surface condition', 'Check for smooth floor, no debris or wet patches', 'med', 100, true),
('preopening', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Ceiling grid/contact surface', 'Inspect overhead power grid is continuous and secure', 'high', 101, true),
('preopening', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Bumper car test drive (each car)', 'Drive each car to verify steering and power pickup', 'med', 102, true),
('preopening', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Rubber bumper ring condition', 'Check bumpers are intact and securely attached', 'med', 103, true),
('preopening', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Seatbelt function (if fitted)', 'Test all seatbelts latch and release correctly', 'med', 104, true);

-- Ferris Wheel (c7b7e6ac-41c6-473c-9520-2cca8b74fa4c)
INSERT INTO check_library_items (frequency, ride_category_id, label, hint, risk_level, sort_index, is_active) VALUES
('preopening', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'Gondola door latches secure', 'Test each door opens and latches securely shut', 'high', 100, true),
('preopening', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'Gondola balancing and swing', 'Check gondolas hang level and swing freely', 'med', 101, true),
('preopening', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'Wheel rotation brake test', 'Verify brake stops and holds wheel at any position', 'high', 102, true),
('preopening', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'Loading platform alignment', 'Check platform aligns with gondolas at loading position', 'med', 103, true),
('preopening', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'Full revolution test cycle', 'Complete 2-3 full rotations checking for smooth operation', 'med', 104, true);

-- Drop Tower (18f61a36-4a6c-4205-bc26-4c57db802c7c)
INSERT INTO check_library_items (frequency, ride_category_id, label, hint, risk_level, sort_index, is_active) VALUES
('preopening', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'Harness lock engagement (each seat)', 'Test every over-shoulder harness locks and sensor confirms', 'high', 100, true),
('preopening', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'Braking system test drop', 'Perform test drop with empty carriage to verify brakes', 'high', 101, true),
('preopening', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'Tower guide rail condition', 'Visual check for obstructions or damage on guide rails', 'high', 102, true),
('preopening', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'Lift mechanism operation', 'Verify smooth ascent without jerking or stalling', 'med', 103, true),
('preopening', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'Proximity sensors responding', 'Confirm all position sensors trigger at correct points', 'high', 104, true);