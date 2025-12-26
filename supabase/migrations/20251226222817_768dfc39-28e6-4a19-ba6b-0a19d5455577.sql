-- Chair-o-Plane specific checks (a5ba73d2-babd-4033-a4a4-58395056a62f)
INSERT INTO check_library_items (label, hint, frequency, ride_category_id, risk_level, sort_index) VALUES
('Chair suspension chains/cables', 'Check for wear, kinks, or damaged links', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 1),
('Chair seat attachment bolts', 'All chair mounts secure with no play', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 2),
('Swing arm pivot points', 'Lubricated and free of excessive wear', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 3),
('Chair tilting mechanism', 'Operates smoothly through full range', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'med', 4),
('Central column bearing', 'No unusual noise or vibration', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 5),
('Canopy/umbrella top secure', 'All decorative elements firmly attached', 'daily', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'med', 6),

-- Carousel specific checks (2db8c089-d30c-442d-b4c2-6297bc6d6615)
('Horse/animal pole security', 'All poles firmly in sockets, no wobble', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'high', 1),
('Galloping mechanism function', 'Up/down motion smooth and consistent', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'med', 2),
('Platform edge condition', 'No gaps or trip hazards at outer rim', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'med', 3),
('Chariot/bench seats secure', 'All seating firmly bolted down', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'high', 4),
('Mirror panel condition', 'Secure, no cracks or sharp edges', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'low', 5),
('Organ music system', 'Audio working, volume appropriate', 'daily', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'low', 6),

-- Dodgems specific checks (e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff)
('Floor conductor grid', 'No loose or exposed strips', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'high', 1),
('Ceiling power grid/poles', 'All contacts secure, no arcing', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'high', 2),
('Bumper car steering wheels', 'All cars steer correctly', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'med', 3),
('Bumper car rubber rings', 'Complete coverage, no gaps', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'med', 4),
('Seat belts in all cars', 'Present and functional in each car', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'high', 5),
('Floor surface condition', 'Smooth, no wet patches or debris', 'daily', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'med', 6),

-- Ferris Wheel specific checks (c7b7e6ac-41c6-473c-9520-2cca8b74fa4c)
('Gondola door latches', 'All doors lock securely when closed', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 1),
('Gondola floor condition', 'No holes, solid flooring in each car', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 2),
('Wheel spoke tension', 'Visual check for bent or loose spokes', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 3),
('Hub and axle bearings', 'No unusual noise during rotation', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 4),
('Gondola swivel mechanism', 'Cars hang level and swing freely', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'med', 5),
('Loading platform alignment', 'Gondolas stop at correct height', 'daily', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'med', 6),

-- Pirate Ship specific checks (4c9a91d3-98a8-456a-ab78-6b9c749b1dc3)
('Main swing arm pivot', 'Smooth movement, no grinding', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'high', 1),
('Boat seating row security', 'All bench seats firmly mounted', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'high', 2),
('Lap bar locking mechanism', 'All restraints lock positively', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'high', 3),
('Anti-rollback brakes', 'Engages correctly at rest position', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'high', 4),
('Counterweights secure', 'All balance weights properly attached', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'high', 5),
('Decorative mast/rigging', 'All theming secure and stable', 'daily', '4c9a91d3-98a8-456a-ab78-6b9c749b1dc3', 'low', 6),

-- Roller Coaster specific checks (dbfb2402-35e8-4539-9a66-dbecb58347a7)
('Track rails and joints', 'No gaps, all bolts tight', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 1),
('Car wheel assemblies', 'All wheels present, proper clearance', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 2),
('Chain lift mechanism', 'Dogs engage, no slipping', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 3),
('Over-the-shoulder restraints', 'Lock at multiple positions', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 4),
('Brake run operation', 'Stops cars smoothly at correct point', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 5),
('Block system sensors', 'All proximity sensors responding', 'daily', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 6),

-- Jumping Castle / Inflatable specific checks (6eed57f2-86a8-40ff-bbed-a822abc70bb6)
('Blower motor operation', 'Running smoothly, air flow constant', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'high', 1),
('Seam condition', 'No separating stitches or holes', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'high', 2),
('Anchor stake security', 'All pegs fully in ground or weights in place', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'high', 3),
('Entry/exit mat condition', 'Properly positioned, no tripping', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'med', 4),
('Netting/enclosure walls', 'All safety nets intact and attached', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'high', 5),
('Surface cleanliness', 'Clean, dry, free of foreign objects', 'daily', '6eed57f2-86a8-40ff-bbed-a822abc70bb6', 'med', 6),

-- Drop Tower specific checks (18f61a36-4a6c-4205-bc26-4c57db802c7c)
('Magnetic brake calibration', 'Brakes slow car at correct rate', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'high', 1),
('Tower guide rails', 'Clean, lubricated, no obstructions', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'high', 2),
('Catch car mechanism', 'Locks positively at top', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'high', 3),
('Shoulder harness locks', 'All positions lock correctly', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'high', 4),
('Pneumatic/hydraulic lines', 'No leaks, proper pressure', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'high', 5),
('Seat floor proximity sensors', 'Detect when riders are seated', 'daily', '18f61a36-4a6c-4205-bc26-4c57db802c7c', 'med', 6),

-- Helter Skelter specific checks (849b7537-e3ce-4497-a7fc-5078735a6f3d)
('Slide surface condition', 'Smooth, no splinters or cracks', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'high', 1),
('Staircase/ramp handrails', 'Secure throughout climb', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'high', 2),
('Mat dispensing area', 'Adequate mats available', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'med', 3),
('Slide exit run-off area', 'Clear and padded', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'med', 4),
('Step tread anti-slip surface', 'All treads have grip intact', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'med', 5),
('Lighting on stairs', 'Adequate illumination for safe climb', 'daily', '849b7537-e3ce-4497-a7fc-5078735a6f3d', 'low', 6);

-- Also add some monthly specific checks for key ride types
INSERT INTO check_library_items (label, hint, frequency, ride_category_id, risk_level, sort_index) VALUES
-- Chair-o-Plane monthly
('Chain/cable wear measurement', 'Measure link wear against tolerances', 'monthly', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 1),
('Swing arm bearing inspection', 'Check for excessive play', 'monthly', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 2),
('Main drive motor inspection', 'Check brushes, bearings, connections', 'monthly', 'a5ba73d2-babd-4033-a4a4-58395056a62f', 'high', 3),

-- Carousel monthly  
('Turntable bearing inspection', 'Check for wear and noise', 'monthly', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'high', 1),
('Gearbox oil level check', 'Top up or replace as needed', 'monthly', '2db8c089-d30c-442d-b4c2-6297bc6d6615', 'med', 2),

-- Ferris Wheel monthly
('Structural bolt torque check', 'Verify tension on critical joints', 'monthly', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 1),
('Gondola pivot pin inspection', 'Check wear and lubrication', 'monthly', 'c7b7e6ac-41c6-473c-9520-2cca8b74fa4c', 'high', 2),

-- Roller Coaster monthly
('Track gauge measurement', 'Check rail spacing at key points', 'monthly', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 1),
('Wheel bearing replacement check', 'Inspect wear, replace if needed', 'monthly', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 2),
('Chain link wear measurement', 'Check against manufacturer limits', 'monthly', 'dbfb2402-35e8-4539-9a66-dbecb58347a7', 'high', 3);