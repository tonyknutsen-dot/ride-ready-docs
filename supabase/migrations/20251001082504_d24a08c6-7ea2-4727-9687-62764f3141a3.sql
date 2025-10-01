-- Add more comprehensive check items to the library

INSERT INTO public.check_library_items (label, frequency, ride_category_id, hint, risk_level, sort_index)
VALUES
-- DAILY — Additional safety and operational checks
('Pre-operational test cycle', 'daily', NULL, 'Run empty cycle, check all movements', 'high', 110),
('Guest communication system', 'daily', NULL, 'PA, intercom, emergency announcements working', 'med', 120),
('CCTV/monitoring systems', 'daily', NULL, 'Camera views clear, recording operational', 'low', 130),
('Ticket booth/payment systems', 'daily', NULL, 'Cash handling, card readers functional', 'low', 140),
('Staff uniforms/ID', 'daily', NULL, 'Team properly identified, high-vis worn', 'low', 150),
('Ride capacity signage', 'daily', NULL, 'Weight/height/age limits clearly displayed', 'med', 160),
('Exit pathways clear', 'daily', NULL, 'Emergency exits unobstructed, marked', 'high', 170),
('Music/sound system', 'daily', NULL, 'Volume appropriate, no distortion', 'low', 180),
('Trash bins positioned', 'daily', NULL, 'Adequate bins, emptied regularly', 'low', 190),
('Weather monitoring equipment', 'daily', NULL, 'Anemometer, rain gauge functional', 'med', 200),

-- MONTHLY — Extended maintenance and inspection
('Chain tension check', 'monthly', NULL, 'Measure slack, adjust per manual', 'high', 80),
('Belt drive inspection', 'monthly', NULL, 'Cracks, fraying, alignment', 'high', 90),
('Brake system test', 'monthly', NULL, 'Pad thickness, response time, parking brake', 'high', 100),
('Emergency lighting test', 'monthly', NULL, 'Battery backup duration check', 'high', 110),
('Ground fault testing', 'monthly', NULL, 'RCD trip times, earth continuity', 'high', 120),
('Pneumatic system check', 'monthly', NULL, 'Air pressure, hose condition, fittings', 'high', 130),
('Structural bolts inspection', 'monthly', NULL, 'Split pins, locking washers, safety wires', 'high', 140),
('Control panel dust/debris', 'monthly', NULL, 'Clean ventilation, check for moisture', 'med', 150),
('Platform/deck condition', 'monthly', NULL, 'Anti-slip surface intact, drainage clear', 'med', 160),
('Ride boundary markers', 'monthly', NULL, 'Paint/tape visible, crowd barriers secure', 'low', 170),

-- YEARLY — Comprehensive annual checks
('Manufacturer service schedule', 'yearly', NULL, 'All items per manufacturer manual completed', 'high', 80),
('Paint and corrosion protection', 'yearly', NULL, 'Touch-up required areas, full repaint schedule', 'med', 90),
('Electrical system certification', 'yearly', NULL, 'PAT testing, installation certificate current', 'high', 100),
('Generator service and load test', 'yearly', NULL, 'Oil change, filters, full load run', 'high', 110),
('Trailer/transport inspection', 'yearly', NULL, 'Tyres, brakes, lights, chassis', 'high', 120),
('Public liability insurance', 'yearly', NULL, 'Policy in date, adequate cover', 'high', 130),
('Operator licenses current', 'yearly', NULL, 'ADIPS cards, competency certificates', 'high', 140),
('Emergency evacuation drill', 'yearly', NULL, 'Staff trained, procedures tested', 'high', 150),
('Noise level assessment', 'yearly', NULL, 'Sound meter readings, council compliance', 'med', 160),
('Waste disposal contracts', 'yearly', NULL, 'Licensed carriers, transfer notes filed', 'low', 170),

-- Ride-specific items (use actual category IDs or NULL for now)
('Lap bar release mechanism', 'daily', NULL, 'Manual override tested, emergency key accessible', 'high', 300),
('Seat belt inspection', 'daily', NULL, 'Webbing intact, buckles click positive', 'high', 310),
('Harness adjustment range', 'daily', NULL, 'All sizes accommodate, locks engage', 'high', 320),
('Station gates/doors', 'daily', NULL, 'Interlocks prevent movement when open', 'high', 330),
('Anti-rollback devices', 'daily', NULL, 'Ratchet sound audible on lift hill', 'high', 340),
('Water slide flow rate', 'daily', NULL, 'Pumps delivering required volume', 'high', 350),
('Pool water chemistry', 'daily', NULL, 'Chlorine, pH within safe range', 'high', 360),
('Inflatable air pressure', 'daily', NULL, 'All chambers firm, blower running', 'high', 370),
('Anchor points secure', 'daily', NULL, 'Stakes/weights in place, ropes tight', 'high', 380),
('Bumper car floor', 'daily', NULL, 'Conductor strips clean, no water', 'high', 390),
('Carousel horses/seats', 'daily', NULL, 'All firmly attached, paint not chipped', 'med', 400),
('Funhouse mirrors secure', 'daily', NULL, 'No cracks, frames stable', 'low', 410),
('Dark ride props working', 'daily', NULL, 'Animations, lighting, sound effects', 'low', 420),
('Go-kart steering/brakes', 'daily', NULL, 'Each vehicle responds correctly', 'high', 430),
('Trampoline mat tension', 'daily', NULL, 'No sag, springs intact', 'high', 440),
('Climbing wall holds tight', 'daily', NULL, 'No loose grips, mats positioned', 'high', 450),
('Laser tag equipment', 'daily', NULL, 'Vests charged, sensors responsive', 'low', 460),
('VR headset hygiene', 'daily', NULL, 'Cleaned between uses, lenses clear', 'low', 470),

-- Monthly ride-specific maintenance
('Roller coaster wheel bearings', 'monthly', NULL, 'No play, smooth rotation', 'high', 200),
('Water pump filters', 'monthly', NULL, 'Clean debris, check impellers', 'high', 210),
('Inflatable seam inspection', 'monthly', NULL, 'Stitching intact, no air leaks', 'high', 220),
('Carousel gearbox oil level', 'monthly', NULL, 'Top up as needed, check for leaks', 'high', 230),
('Swing ride chains', 'monthly', NULL, 'Swivels rotate freely, no cracks', 'high', 240),
('Pirate ship pivot bearings', 'monthly', NULL, 'Grease, check for wear', 'high', 250),
('Ferris wheel gondola hinges', 'monthly', NULL, 'Doors self-close, latches secure', 'high', 260),
('Simulator motion base', 'monthly', NULL, 'Hydraulic fluid level, seal condition', 'high', 270),

-- Yearly ride-specific checks
('Track alignment survey', 'yearly', NULL, 'Laser measurement, gauge verification', 'high', 180),
('Structural weld inspection', 'yearly', NULL, 'NDT on critical welds, crack detection', 'high', 190),
('Ride vehicle overhaul', 'yearly', NULL, 'Strip, inspect, rebuild per schedule', 'high', 200),
('Lift mechanism certification', 'yearly', NULL, 'Third-party inspection, load test', 'high', 210),
('Water treatment system service', 'yearly', NULL, 'Replace filters, sanitize tanks', 'high', 220),
('Inflatable fabric certification', 'yearly', NULL, 'Manufacturer inspection, flame test', 'high', 230),
('Carousel restoration items', 'yearly', NULL, 'Wood treatment, metalwork refurbishment', 'med', 240)

ON CONFLICT DO NOTHING;