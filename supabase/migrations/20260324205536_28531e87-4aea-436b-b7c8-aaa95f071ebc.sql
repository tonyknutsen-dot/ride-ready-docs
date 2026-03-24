-- Normalize equipment_group values to canonical lowercase keys
-- Matches src/constants/checkLibrary.ts EQUIPMENT_GROUPS
-- Before: 478 total rows, 2 rows with 'Rides' (PascalCase), rest already lowercase
-- After: all rows use lowercase underscore keys

UPDATE public.check_library_items
SET equipment_group = LOWER(REPLACE(equipment_group, ' ', '_'))
WHERE equipment_group != LOWER(REPLACE(equipment_group, ' ', '_'));