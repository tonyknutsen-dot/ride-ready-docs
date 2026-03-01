
INSERT INTO public.risk_library_items (item_type, equipment_group, category, label, sort_index, is_active)
VALUES
-- ═══════════════════════════════════════════
-- GENERAL — Electrical Safety
-- ═══════════════════════════════════════════
('hazard', 'general', 'Electrical Safety', 'Exposed or damaged electrical cables', 1, true),
('hazard', 'general', 'Electrical Safety', 'Overloaded electrical circuits', 2, true),
('hazard', 'general', 'Electrical Safety', 'Lack of residual current device (RCD) protection', 3, true),
('hazard', 'general', 'Electrical Safety', 'Water ingress into electrical enclosures', 4, true),
('hazard', 'general', 'Electrical Safety', 'Improper earthing or bonding', 5, true),
('hazard', 'general', 'Electrical Safety', 'Damaged plugs, sockets, or connectors', 6, true),
('hazard', 'general', 'Electrical Safety', 'Unauthorised modifications to electrical systems', 7, true),
('hazard', 'general', 'Electrical Safety', 'Electrical equipment not PAT tested', 8, true),
('hazard', 'general', 'Electrical Safety', 'Generator supply cable damaged or undersized', 9, true),
('hazard', 'general', 'Electrical Safety', 'Temporary wiring not properly secured', 10, true),
('control', 'general', 'Electrical Safety', 'Regular PAT testing of all portable appliances', 11, true),
('control', 'general', 'Electrical Safety', 'RCD protection on all circuits', 12, true),
('control', 'general', 'Electrical Safety', 'Weatherproof enclosures for outdoor electrical equipment', 13, true),
('control', 'general', 'Electrical Safety', 'Daily visual inspection of cables and connections', 14, true),
('control', 'general', 'Electrical Safety', 'Qualified electrician for all electrical work', 15, true),
('control', 'general', 'Electrical Safety', 'Electrical isolation procedures in place', 16, true),
('control', 'general', 'Electrical Safety', 'Cable management to prevent trip hazards', 17, true),
('control', 'general', 'Electrical Safety', 'Isolation switches accessible for emergency use', 18, true),
('control', 'general', 'Electrical Safety', 'Temporary wiring secured and protected from damage', 19, true),

-- ═══════════════════════════════════════════
-- GENERAL — Structural Integrity
-- ═══════════════════════════════════════════
('hazard', 'general', 'Structural Integrity', 'Corrosion or rust on structural members', 20, true),
('hazard', 'general', 'Structural Integrity', 'Cracked or fractured welds', 21, true),
('hazard', 'general', 'Structural Integrity', 'Missing or loose bolts and fasteners', 22, true),
('hazard', 'general', 'Structural Integrity', 'Foundation or ground anchor failure', 23, true),
('hazard', 'general', 'Structural Integrity', 'Fatigue cracking in load-bearing components', 24, true),
('hazard', 'general', 'Structural Integrity', 'Unauthorised structural modifications', 25, true),
('hazard', 'general', 'Structural Integrity', 'Overloading beyond design capacity', 26, true),
('hazard', 'general', 'Structural Integrity', 'Guy rope or tension cable degradation', 27, true),
('control', 'general', 'Structural Integrity', 'Annual structural inspection by competent person', 28, true),
('control', 'general', 'Structural Integrity', 'Torque checking on critical fasteners', 29, true),
('control', 'general', 'Structural Integrity', 'Non-destructive testing programme in place', 30, true),
('control', 'general', 'Structural Integrity', 'Visual inspection before each operating period', 31, true),
('control', 'general', 'Structural Integrity', 'Load limits clearly displayed and enforced', 32, true),
('control', 'general', 'Structural Integrity', 'Corrosion protection maintained', 33, true),
('control', 'general', 'Structural Integrity', 'Structural modification log maintained', 34, true),
('control', 'general', 'Structural Integrity', 'Manufacturer structural maintenance schedule followed', 35, true),

-- ═══════════════════════════════════════════
-- GENERAL — Fire Safety
-- ═══════════════════════════════════════════
('hazard', 'general', 'Fire Safety', 'Combustible materials stored near ignition sources', 36, true),
('hazard', 'general', 'Fire Safety', 'Blocked fire exits or escape routes', 37, true),
('hazard', 'general', 'Fire Safety', 'Missing or expired fire extinguishers', 38, true),
('hazard', 'general', 'Fire Safety', 'LPG or fuel storage not compliant with regulations', 39, true),
('hazard', 'general', 'Fire Safety', 'Electrical fault causing fire', 40, true),
('hazard', 'general', 'Fire Safety', 'Smoking in prohibited areas', 41, true),
('hazard', 'general', 'Fire Safety', 'Lack of fire detection or alarm system', 42, true),
('hazard', 'general', 'Fire Safety', 'Pyrotechnic or firework storage on site', 43, true),
('control', 'general', 'Fire Safety', 'Fire extinguishers serviced and accessible', 44, true),
('control', 'general', 'Fire Safety', 'Fire risk assessment completed and reviewed', 45, true),
('control', 'general', 'Fire Safety', 'Clear and signed escape routes maintained', 46, true),
('control', 'general', 'Fire Safety', 'LPG stored and handled per regulations', 47, true),
('control', 'general', 'Fire Safety', 'No smoking policy enforced', 48, true),
('control', 'general', 'Fire Safety', 'Staff trained in fire evacuation procedures', 49, true),
('control', 'general', 'Fire Safety', 'Hot work permit system in place', 50, true),
('control', 'general', 'Fire Safety', 'Pyrotechnic risk assessment and licence verified', 51, true),

-- ═══════════════════════════════════════════
-- GENERAL — Public Safety
-- ═══════════════════════════════════════════
('hazard', 'general', 'Public Safety', 'Public misbehaviour affecting safety', 52, true),
('hazard', 'general', 'Public Safety', 'Overcrowding in operating area', 53, true),
('hazard', 'general', 'Public Safety', 'Inadequate crowd control barriers', 54, true),
('hazard', 'general', 'Public Safety', 'Poor lighting in public areas', 55, true),
('hazard', 'general', 'Public Safety', 'Slip, trip, and fall hazards on walkways', 56, true),
('hazard', 'general', 'Public Safety', 'Unsupervised children in operating area', 57, true),
('hazard', 'general', 'Public Safety', 'Rider not meeting height or health restrictions', 58, true),
('hazard', 'general', 'Public Safety', 'Pinch points or entrapment hazards accessible to public', 59, true),
('hazard', 'general', 'Public Safety', 'Intoxicated persons in operating area', 60, true),
('hazard', 'general', 'Public Safety', 'Accessibility hazards for disabled visitors', 61, true),
('hazard', 'general', 'Public Safety', 'Inadequate signage for hazards and restrictions', 62, true),
('control', 'general', 'Public Safety', 'Height and health restriction signage displayed', 63, true),
('control', 'general', 'Public Safety', 'Queue management system in place', 64, true),
('control', 'general', 'Public Safety', 'Adequate lighting maintained in all public areas', 65, true),
('control', 'general', 'Public Safety', 'Regular walkway inspections for trip hazards', 66, true),
('control', 'general', 'Public Safety', 'Crowd control barriers maintained', 67, true),
('control', 'general', 'Public Safety', 'Supervision of operating area at all times', 68, true),
('control', 'general', 'Public Safety', 'Incident reporting procedure in place', 69, true),
('control', 'general', 'Public Safety', 'Intoxicated persons refused entry policy enforced', 70, true),
('control', 'general', 'Public Safety', 'Accessibility assessment completed', 71, true),
('control', 'general', 'Public Safety', 'Hazard and restriction signage reviewed regularly', 72, true),

-- ═══════════════════════════════════════════
-- GENERAL — Weather & Environment
-- ═══════════════════════════════════════════
('hazard', 'general', 'Weather & Environment', 'High wind speeds exceeding safe operating limits', 73, true),
('hazard', 'general', 'Weather & Environment', 'Heavy rain affecting ground conditions', 74, true),
('hazard', 'general', 'Weather & Environment', 'Lightning risk during thunderstorms', 75, true),
('hazard', 'general', 'Weather & Environment', 'Extreme heat causing equipment failure or heat stress', 76, true),
('hazard', 'general', 'Weather & Environment', 'Ice or frost on surfaces and structures', 77, true),
('hazard', 'general', 'Weather & Environment', 'Poor visibility due to fog or mist', 78, true),
('hazard', 'general', 'Weather & Environment', 'UV exposure for staff working outdoors', 79, true),
('hazard', 'general', 'Weather & Environment', 'Flooding or waterlogging of site', 80, true),
('hazard', 'general', 'Weather & Environment', 'Strong sunlight causing glare affecting operators', 81, true),
('control', 'general', 'Weather & Environment', 'Wind speed monitoring and closure limits defined', 82, true),
('control', 'general', 'Weather & Environment', 'Weather monitoring during operations', 83, true),
('control', 'general', 'Weather & Environment', 'Lightning protection assessment completed', 84, true),
('control', 'general', 'Weather & Environment', 'Ground condition checks after adverse weather', 85, true),
('control', 'general', 'Weather & Environment', 'Anti-slip measures applied in wet or icy conditions', 86, true),
('control', 'general', 'Weather & Environment', 'Heat stress risk assessment for staff', 87, true),
('control', 'general', 'Weather & Environment', 'Operating limits for adverse weather documented', 88, true),
('control', 'general', 'Weather & Environment', 'Flood risk assessment for site completed', 89, true),
('control', 'general', 'Weather & Environment', 'Glare assessment for operator positions', 90, true),

-- ═══════════════════════════════════════════
-- GENERAL — Operational Safety
-- ═══════════════════════════════════════════
('hazard', 'general', 'Operational Safety', 'Untrained operator controlling equipment', 91, true),
('hazard', 'general', 'Operational Safety', 'Operator fatigue during long shifts', 92, true),
('hazard', 'general', 'Operational Safety', 'Communication failure between operators', 93, true),
('hazard', 'general', 'Operational Safety', 'Operating outside manufacturer guidelines', 94, true),
('hazard', 'general', 'Operational Safety', 'Start-up without completing safety checks', 95, true),
('hazard', 'general', 'Operational Safety', 'Equipment operated while defective', 96, true),
('hazard', 'general', 'Operational Safety', 'Inadequate staffing levels for safe operation', 97, true),
('hazard', 'general', 'Operational Safety', 'Simultaneous operations creating conflicting hazards', 98, true),
('control', 'general', 'Operational Safety', 'Operator training and competency records maintained', 99, true),
('control', 'general', 'Operational Safety', 'Operating procedures documented and accessible', 100, true),
('control', 'general', 'Operational Safety', 'Pre-operating safety checks completed daily', 101, true),
('control', 'general', 'Operational Safety', 'Communication systems tested before operations', 102, true),
('control', 'general', 'Operational Safety', 'Shift patterns managed to prevent fatigue', 103, true),
('control', 'general', 'Operational Safety', 'Defect reporting and lockout procedures in place', 104, true),
('control', 'general', 'Operational Safety', 'Minimum staffing levels documented', 105, true),
('control', 'general', 'Operational Safety', 'Permit to work system for conflicting operations', 106, true),

-- ═══════════════════════════════════════════
-- GENERAL — Emergency Procedures
-- ═══════════════════════════════════════════
('hazard', 'general', 'Emergency Procedures', 'No emergency evacuation plan in place', 107, true),
('hazard', 'general', 'Emergency Procedures', 'Person stranded at height requiring rescue', 108, true),
('hazard', 'general', 'Emergency Procedures', 'Medical emergency with no trained first aider', 109, true),
('hazard', 'general', 'Emergency Procedures', 'Power failure during operation', 110, true),
('hazard', 'general', 'Emergency Procedures', 'Structural collapse or major failure', 111, true),
('hazard', 'general', 'Emergency Procedures', 'Communication failure with emergency services', 112, true),
('hazard', 'general', 'Emergency Procedures', 'No emergency contact information displayed', 113, true),
('control', 'general', 'Emergency Procedures', 'Emergency evacuation plan documented and rehearsed', 114, true),
('control', 'general', 'Emergency Procedures', 'First aid equipment and trained first aiders available', 115, true),
('control', 'general', 'Emergency Procedures', 'Emergency stop systems tested regularly', 116, true),
('control', 'general', 'Emergency Procedures', 'Emergency services access route maintained', 117, true),
('control', 'general', 'Emergency Procedures', 'Emergency lighting and backup power available', 118, true),
('control', 'general', 'Emergency Procedures', 'Rescue plan for persons stranded at height', 119, true),
('control', 'general', 'Emergency Procedures', 'Emergency contact details prominently displayed', 120, true),

-- ═══════════════════════════════════════════
-- GENERAL — Site Safety
-- ═══════════════════════════════════════════
('hazard', 'general', 'Site Safety', 'Uneven or unstable ground surface', 121, true),
('hazard', 'general', 'Site Safety', 'Vehicle movements in pedestrian areas', 122, true),
('hazard', 'general', 'Site Safety', 'Inadequate site perimeter fencing', 123, true),
('hazard', 'general', 'Site Safety', 'Contaminated ground or standing water', 124, true),
('hazard', 'general', 'Site Safety', 'Overhead hazards from adjacent structures', 125, true),
('hazard', 'general', 'Site Safety', 'Temporary structures not adequately secured', 126, true),
('hazard', 'general', 'Site Safety', 'Underground services not properly identified', 127, true),
('hazard', 'general', 'Site Safety', 'Sharp debris or broken glass on site', 128, true),
('control', 'general', 'Site Safety', 'Ground condition assessment before setup', 129, true),
('control', 'general', 'Site Safety', 'Vehicle and pedestrian segregation enforced', 130, true),
('control', 'general', 'Site Safety', 'Site perimeter secured and signed', 131, true),
('control', 'general', 'Site Safety', 'Drainage maintained to prevent standing water', 132, true),
('control', 'general', 'Site Safety', 'Overhead clearance checks completed', 133, true),
('control', 'general', 'Site Safety', 'Temporary structures inspected after erection', 134, true),
('control', 'general', 'Site Safety', 'Underground services located before ground work', 135, true),
('control', 'general', 'Site Safety', 'Regular site litter and debris clearance', 136, true),

-- ═══════════════════════════════════════════
-- GENERAL — Manual Handling
-- ═══════════════════════════════════════════
('hazard', 'general', 'Manual Handling', 'Heavy components requiring manual lifting', 137, true),
('hazard', 'general', 'Manual Handling', 'Repetitive handling during build-up or teardown', 138, true),
('hazard', 'general', 'Manual Handling', 'Awkward loads causing musculoskeletal injury', 139, true),
('hazard', 'general', 'Manual Handling', 'Working in awkward positions during setup', 140, true),
('control', 'general', 'Manual Handling', 'Manual handling risk assessment completed', 141, true),
('control', 'general', 'Manual Handling', 'Mechanical lifting aids available', 142, true),
('control', 'general', 'Manual Handling', 'Staff trained in safe manual handling techniques', 143, true),
('control', 'general', 'Manual Handling', 'Task rotation to reduce repetitive strain', 144, true),

-- ═══════════════════════════════════════════
-- GENERAL — Noise & Vibration
-- ═══════════════════════════════════════════
('hazard', 'general', 'Noise & Vibration', 'Excessive noise levels from equipment', 145, true),
('hazard', 'general', 'Noise & Vibration', 'Vibration exposure during operation', 146, true),
('control', 'general', 'Noise & Vibration', 'Noise assessment completed', 147, true),
('control', 'general', 'Noise & Vibration', 'Hearing protection provided where required', 148, true),
('control', 'general', 'Noise & Vibration', 'Vibration exposure monitoring for staff', 149, true),

-- ═══════════════════════════════════════════
-- GENERAL — Chemical & Substance
-- ═══════════════════════════════════════════
('hazard', 'general', 'Chemical & Substance', 'Hydraulic fluid or oil leaks', 150, true),
('hazard', 'general', 'Chemical & Substance', 'Cleaning chemicals stored improperly', 151, true),
('hazard', 'general', 'Chemical & Substance', 'Fuel spillage or vapour exposure', 152, true),
('hazard', 'general', 'Chemical & Substance', 'Paint or coating fumes during maintenance', 153, true),
('control', 'general', 'Chemical & Substance', 'COSHH assessments completed for all substances', 154, true),
('control', 'general', 'Chemical & Substance', 'Spill kits available and accessible', 155, true),
('control', 'general', 'Chemical & Substance', 'Proper storage for all hazardous substances', 156, true),
('control', 'general', 'Chemical & Substance', 'Ventilation provided during painting or coating work', 157, true),

-- ═══════════════════════════════════════════
-- GENERAL — Access & Egress
-- ═══════════════════════════════════════════
('hazard', 'general', 'Access & Egress', 'Inadequate access for maintenance at height', 158, true),
('hazard', 'general', 'Access & Egress', 'Ladder or scaffold not properly secured', 159, true),
('hazard', 'general', 'Access & Egress', 'Confined space entry required', 160, true),
('control', 'general', 'Access & Egress', 'Work at height risk assessment completed', 161, true),
('control', 'general', 'Access & Egress', 'Access equipment inspected before use', 162, true),
('control', 'general', 'Access & Egress', 'Confined space entry procedures in place', 163, true),

-- ═══════════════════════════════════════════
-- GENERAL — PPE
-- ═══════════════════════════════════════════
('hazard', 'general', 'PPE', 'Lack of appropriate PPE for maintenance tasks', 164, true),
('hazard', 'general', 'PPE', 'Damaged or worn PPE not replaced', 165, true),
('control', 'general', 'PPE', 'PPE requirements documented for each task', 166, true),
('control', 'general', 'PPE', 'PPE inspection and replacement programme in place', 167, true),

-- ═══════════════════════════════════════════
-- RIDES — Mechanical Safety
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Mechanical Safety', 'Worn or damaged bearings', 1, true),
('hazard', 'rides', 'Mechanical Safety', 'Chain or belt drive failure', 2, true),
('hazard', 'rides', 'Mechanical Safety', 'Brake system malfunction', 3, true),
('hazard', 'rides', 'Mechanical Safety', 'Gear mechanism wear or failure', 4, true),
('hazard', 'rides', 'Mechanical Safety', 'Axle or shaft fatigue cracking', 5, true),
('hazard', 'rides', 'Mechanical Safety', 'Clutch or coupling failure', 6, true),
('hazard', 'rides', 'Mechanical Safety', 'Track or rail wear beyond tolerance', 7, true),
('hazard', 'rides', 'Mechanical Safety', 'Wheel or roller degradation', 8, true),
('hazard', 'rides', 'Mechanical Safety', 'Drive motor overheating', 9, true),
('hazard', 'rides', 'Mechanical Safety', 'Gearbox oil contamination or low level', 10, true),

-- ═══════════════════════════════════════════
-- RIDES — Hydraulic & Pneumatic
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Hydraulic hose burst or leak', 11, true),
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Pneumatic system pressure loss', 12, true),
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Hydraulic ram seal failure', 13, true),
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Contaminated hydraulic fluid', 14, true),
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Pressure relief valve failure', 15, true),
('hazard', 'rides', 'Hydraulic & Pneumatic', 'Air compressor malfunction', 16, true),

-- ═══════════════════════════════════════════
-- RIDES — Rider Safety
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Rider Safety', 'Rider ejection during operation', 17, true),
('hazard', 'rides', 'Rider Safety', 'Rider limbs extending beyond safe envelope', 18, true),
('hazard', 'rides', 'Rider Safety', 'Rider collision with structure or other riders', 19, true),
('hazard', 'rides', 'Rider Safety', 'Motion sickness or disorientation causing injury', 20, true),
('hazard', 'rides', 'Rider Safety', 'Rider panic causing unsafe behaviour', 21, true),
('hazard', 'rides', 'Rider Safety', 'Loose articles becoming projectiles', 22, true),
('hazard', 'rides', 'Rider Safety', 'Rider loading or unloading while ride in motion', 23, true),
('hazard', 'rides', 'Rider Safety', 'Inadequate rider briefing before operation', 24, true),

-- ═══════════════════════════════════════════
-- RIDES — Restraint Systems
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Restraint Systems', 'Lap bar or harness not locking correctly', 25, true),
('hazard', 'rides', 'Restraint Systems', 'Seat belt or strap wear or fraying', 26, true),
('hazard', 'rides', 'Restraint Systems', 'Restraint release during operation', 27, true),
('hazard', 'rides', 'Restraint Systems', 'Restraint not sized for rider body type', 28, true),
('hazard', 'rides', 'Restraint Systems', 'Secondary restraint system failure', 29, true),

-- ═══════════════════════════════════════════
-- RIDES — Control Systems
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Control Systems', 'Emergency stop system failure', 30, true),
('hazard', 'rides', 'Control Systems', 'Sensor or proximity switch malfunction', 31, true),
('hazard', 'rides', 'Control Systems', 'PLC or control software fault', 32, true),
('hazard', 'rides', 'Control Systems', 'Speed governor failure', 33, true),
('hazard', 'rides', 'Control Systems', 'Interlock system bypass or failure', 34, true),
('hazard', 'rides', 'Control Systems', 'Operator control panel malfunction', 35, true),

-- ═══════════════════════════════════════════
-- RIDES — Speed & Motion
-- ═══════════════════════════════════════════
('hazard', 'rides', 'Speed & Motion', 'Excessive G-forces beyond design limits', 36, true),
('hazard', 'rides', 'Speed & Motion', 'Sudden unexpected stop during ride cycle', 37, true),
('hazard', 'rides', 'Speed & Motion', 'Uncontrolled acceleration', 38, true),
('hazard', 'rides', 'Speed & Motion', 'Oscillation or vibration beyond normal parameters', 39, true),

-- ═══════════════════════════════════════════
-- RIDES — Controls
-- ═══════════════════════════════════════════
('control', 'rides', 'Rider Safety', 'Pre-ride safety briefings given to riders', 40, true),
('control', 'rides', 'Restraint Systems', 'Restraint check before each ride cycle', 41, true),
('control', 'rides', 'Speed & Motion', 'Speed and G-force monitoring systems in place', 42, true),
('control', 'rides', 'Control Systems', 'Emergency stop tested before each operating period', 43, true),
('control', 'rides', 'Hydraulic & Pneumatic', 'Hydraulic system pressure checks daily', 44, true),
('control', 'rides', 'Mechanical Safety', 'Bearing temperature monitoring', 45, true),
('control', 'rides', 'Mechanical Safety', 'Brake testing before first ride of the day', 46, true),
('control', 'rides', 'Mechanical Safety', 'Ride cycle counter maintained', 47, true),
('control', 'rides', 'Mechanical Safety', 'Manufacturer maintenance schedule followed', 48, true),
('control', 'rides', 'Control Systems', 'Control system diagnostics run daily', 49, true),
('control', 'rides', 'Rider Safety', 'Rider height measurement check at entrance', 50, true),

-- ═══════════════════════════════════════════
-- INFLATABLES — Inflatable Safety
-- ═══════════════════════════════════════════
('hazard', 'inflatables', 'Inflatable Safety', 'Blower unit failure causing deflation', 1, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Anchor point failure in high winds', 2, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Dynamic forces causing rocking or swaying', 3, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Overcrowding on inflatable structure', 4, true),
('hazard', 'inflatables', 'Inflatable Safety', 'User collision during bouncing', 5, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Seam tear or structural failure', 6, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Entrapment between inflatable and ground', 7, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Wet surface causing slipping', 8, true),
('hazard', 'inflatables', 'Inflatable Safety', 'Unauthorised access when unsupervised', 9, true),
('control', 'inflatables', 'Inflatable Safety', 'Blower unit checked and tested before use', 10, true),
('control', 'inflatables', 'Inflatable Safety', 'Minimum anchor points per PIPA guidelines', 11, true),
('control', 'inflatables', 'Inflatable Safety', 'Wind speed limits enforced per manufacturer specification', 12, true),
('control', 'inflatables', 'Inflatable Safety', 'Maximum user capacity displayed and enforced', 13, true),
('control', 'inflatables', 'Inflatable Safety', 'Age and size segregation during sessions', 14, true),
('control', 'inflatables', 'Inflatable Safety', 'Daily inflation and seam integrity check', 15, true),
('control', 'inflatables', 'Inflatable Safety', 'Continuous supervision during use', 16, true),

-- ═══════════════════════════════════════════
-- FOOD_STALLS — Food Safety
-- ═══════════════════════════════════════════
('hazard', 'food_stalls', 'Food Safety', 'Hot oil or liquid burns', 1, true),
('hazard', 'food_stalls', 'Food Safety', 'Gas leak from cooking appliances', 2, true),
('hazard', 'food_stalls', 'Food Safety', 'Cross-contamination of food allergens', 3, true),
('hazard', 'food_stalls', 'Food Safety', 'Inadequate food storage temperature', 4, true),
('hazard', 'food_stalls', 'Food Safety', 'Slip hazard from grease or liquid spills', 5, true),
('hazard', 'food_stalls', 'Food Safety', 'Fire risk from deep fat fryers', 6, true),
('hazard', 'food_stalls', 'Food Safety', 'Contaminated water supply', 7, true),
('hazard', 'food_stalls', 'Food Safety', 'Pest infestation in storage areas', 8, true),
('control', 'food_stalls', 'Food Safety', 'Food hygiene rating displayed', 9, true),
('control', 'food_stalls', 'Food Safety', 'Gas safety certificate current', 10, true),
('control', 'food_stalls', 'Food Safety', 'Temperature monitoring logs maintained', 11, true),
('control', 'food_stalls', 'Food Safety', 'Allergen information displayed for customers', 12, true),
('control', 'food_stalls', 'Food Safety', 'Non-slip matting in food preparation areas', 13, true),
('control', 'food_stalls', 'Food Safety', 'Fire suppression system for deep fat fryers', 14, true),

-- ═══════════════════════════════════════════
-- GAMES — Game Safety
-- ═══════════════════════════════════════════
('hazard', 'games', 'Game Safety', 'Projectile rebound causing injury', 1, true),
('hazard', 'games', 'Game Safety', 'Customer reaching into restricted game area', 2, true),
('hazard', 'games', 'Game Safety', 'Prize or equipment falling from height', 3, true),
('hazard', 'games', 'Game Safety', 'Sharp edges on game equipment', 4, true),
('control', 'games', 'Game Safety', 'Protective barriers around game area', 5, true),
('control', 'games', 'Game Safety', 'Regular inspection of game equipment', 6, true),
('control', 'games', 'Game Safety', 'Safe prize storage and display', 7, true),

-- ═══════════════════════════════════════════
-- STALLS — Stall Safety
-- ═══════════════════════════════════════════
('hazard', 'stalls', 'Stall Safety', 'Stall structure collapse or instability', 1, true),
('hazard', 'stalls', 'Stall Safety', 'Overhead signage or display falling', 2, true),
('hazard', 'stalls', 'Stall Safety', 'Stock or display items toppling', 3, true),
('control', 'stalls', 'Stall Safety', 'Stall structure secured and inspected', 4, true),
('control', 'stalls', 'Stall Safety', 'Overhead fixtures properly anchored', 5, true),
('control', 'stalls', 'Stall Safety', 'Stock displays stable and within weight limits', 6, true),

-- ═══════════════════════════════════════════
-- ATTRACTIONS — Attraction Safety
-- ═══════════════════════════════════════════
('hazard', 'attractions', 'Attraction Safety', 'Walkway or platform collapse', 1, true),
('hazard', 'attractions', 'Attraction Safety', 'Special effects malfunction (lighting, sound, fog)', 2, true),
('hazard', 'attractions', 'Attraction Safety', 'Emergency exit blocked or poorly marked', 3, true),
('control', 'attractions', 'Attraction Safety', 'Walkway load capacity verified', 4, true),
('control', 'attractions', 'Attraction Safety', 'Special effects equipment maintained and tested', 5, true),
('control', 'attractions', 'Attraction Safety', 'Emergency exits clearly marked and accessible', 6, true),

-- ═══════════════════════════════════════════
-- EQUIPMENT — Generator & Equipment Safety
-- ═══════════════════════════════════════════
('hazard', 'equipment', 'Generator & Equipment Safety', 'Generator exhaust fumes in enclosed area', 1, true),
('hazard', 'equipment', 'Generator & Equipment Safety', 'Fuel storage fire or explosion risk', 2, true),
('hazard', 'equipment', 'Generator & Equipment Safety', 'Generator overload causing failure', 3, true),
('hazard', 'equipment', 'Generator & Equipment Safety', 'Electrical output voltage fluctuation', 4, true),
('hazard', 'equipment', 'Generator & Equipment Safety', 'Noise exposure from generator operation', 5, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Generator positioned with adequate ventilation', 6, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Fuel stored in approved containers away from public', 7, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Load management to prevent generator overload', 8, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Regular generator servicing and maintenance log', 9, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Exhaust fume monitoring in enclosed spaces', 10, true),
('control', 'equipment', 'Generator & Equipment Safety', 'Emergency fuel shut-off accessible', 11, true);
