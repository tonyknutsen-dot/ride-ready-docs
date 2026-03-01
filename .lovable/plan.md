

# Plan: Seed risk_library_items (~278 items)

## Approach

A single SQL data operation inserting all ~278 hazards and controls into the `risk_library_items` table. No schema changes, no UI changes.

## Data breakdown

| equipment_group | hazards | controls | total |
|----------------|---------|----------|-------|
| general | ~90 | ~76 | ~166 |
| rides | ~41 | ~11 | ~52 |
| inflatables | 9 | 7 | 16 |
| food_stalls | 8 | 6 | 14 |
| games | 4 | 3 | 7 |
| stalls | 3 | 3 | 6 |
| attractions | 3 | 3 | 6 |
| equipment | 5 | 6 | 11 |

## What happens

- One large INSERT into `risk_library_items` with all items
- Each row: `item_type`, `equipment_group`, `category`, `label`, `sort_index`, `is_active = true`
- No `hint` or `ride_category_id` set (can be added later via admin)
- No existing data modified — empty table receives inserts only
- Terminology: "Rider Safety" (rides), "Public Safety" (general), "Customer" (games/stalls) — no "patron" anywhere

## After seeding

I will query the database to confirm counts and show samples for rides, inflatables, food stalls, and equipment/generators as requested. No UI refactor until you approve.

## Technical note

This will be executed as a data INSERT operation (not a schema migration), since the table already exists.

