

# Plan: Risk Assessment Library UI Refactor

## What Changes

### 1. New file: `src/components/risk-assessment/RiskLibraryDialog.tsx`

A dialog component modelled on `CheckLibraryDialog` that:

- Accepts props: `trigger` (ReactNode), `itemType` ("hazard" | "control"), `equipmentGroup` (string), `onSelect` (callback returning selected label)
- On open, fetches from `risk_library_items` where `item_type = itemType` AND `equipment_group IN ('general', equipmentGroup)` AND `is_active = true`, ordered by `category, sort_index`
- Displays three segmented filter tabs in this order: **[Group-Specific]** (default) | **General** | **All**
  - Default tab is the group-specific tab; falls back to General if the group has 0 items
- Within each tab, items are grouped by `category` with bold section headers (e.g. "Mechanical Safety", "Rider Safety")
- Search bar filters items by label within the active tab
- Single-select: clicking an item calls `onSelect(label)` and closes the dialog
- Shows item counts in each tab label

### 2. Edit: `src/components/RiskAssessmentManager.tsx`

- Expand `RiskAssessmentManagerProps.ride` to include `ride_categories?: { category_group: string }` 
- Add a `categoryGroupToEquipmentGroup` mapping function (e.g. "Food Stalls" → "food_stalls", "Rides" → "rides", "Inflatables" → "inflatables")
- **Hazard section** (lines ~1768-1957): Replace the `<Collapsible>` category browser + `<Select>` with hardcoded `<SelectItem>` entries (~175 lines) with a `<RiskLibraryDialog>` component. Keep the "Enter Custom Hazard" / "Browse Library" toggle as-is, but the "Browse Library" path now opens the dialog instead of showing the dropdown
- **Control section** (lines ~2019-2154): Same replacement — remove the `<Collapsible>` + `<Select>` with ~120 hardcoded `<SelectItem>` entries, replace with `<RiskLibraryDialog>`
- This removes all remaining "Patron" terminology from the codebase (lines 1924, 1928, 2078)
- Import `RiskLibraryDialog` at the top of the file

### 3. Edit: `src/pages/RiskAssessments.tsx`

- No changes needed. The page already passes the full `Ride` object (which includes `ride_categories.category_group`) to `RiskAssessmentManager`. The expanded prop interface will accept it.

### No database changes

Reads from existing `risk_library_items` table with existing RLS policy (`is_active = true` for SELECT).

### Category sections that will appear in the dialog

Based on the seeded data:

| equipment_group | Categories |
|----------------|------------|
| general (84h/83c) | Electrical Safety, Structural Integrity, Fire Safety, Public Safety, Weather & Environment, Operational Safety, Site Safety, Emergency Procedures, Chemical & Substance, Manual Handling, Access & Egress, Noise & Vibration, PPE |
| rides (39h/11c) | Mechanical Safety, Rider Safety, Hydraulic & Pneumatic, Control Systems, Restraint Systems, Speed & Motion |
| inflatables (9h/7c) | Inflatable Safety |
| food_stalls (8h/6c) | Food Safety |
| equipment (5h/6c) | Generator & Equipment Safety |
| games (4h/3c) | Game Safety |
| stalls (3h/3c) | Stall Safety |
| attractions (3h/3c) | Attraction Safety |

