

# Implementation Plan

## Tasks

1. **Database migration** — Create `wind_speed_logs` table + update 3 library items removing PIPA/ADIPS/RPII
2. **PIPA/ADIPS code edits** — Update placeholder text in `MarkCompleteSheet.tsx`, `CompletedEventEditSheet.tsx`, and help-chat system prompt
3. **RA delete confirmation** — Wrap trash button in `RiskItemCard.tsx` with `AlertDialog`
4. **Wind Log component** — Create `src/components/WindSpeedLog.tsx`
5. **RideDetail tab update** — Add conditional "Wind Log" tab for inflatables with mobile-safe flex layout

## 1. Migration: `wind_speed_logs` table + library wording

Single migration with two clean sections:

**Section A — Wording updates (3 UPDATEs):**

| Table | ID | New label |
|-------|-----|-----------|
| `risk_library_items` | `22cf1f9d-...` | "Minimum anchor points and anchorage arrangement in accordance with the applicable standard and manufacturer guidance" |
| `check_library_items` | `ce41a7a4-...` | "Annual inspection certificate valid" |
| `check_library_items` | `34127147-...` | "Annual independent inspection" |

**Section B — `wind_speed_logs` table:**

Columns: `id` (uuid PK), `user_id`, `ride_id` (FK → rides CASCADE), `log_date` (date, default CURRENT_DATE), `log_time` (time), `wind_speed` (numeric, NOT NULL), `wind_unit` (text, default 'mph'), `recorded_by` (text, NOT NULL), `location` (text), `anemometer_make/model/serial` (text), `action_taken` (text), `notes` (text), `created_at` (timestamptz).

Index on `(ride_id, log_date DESC)`. RLS: deny anonymous, owner ALL, staff SELECT+INSERT for assigned rides.

## 2. PIPA/ADIPS code edits

- **`MarkCompleteSheet.tsx`** line 454: placeholder → `"e.g. Independent Inspector, LEAPS, DMG Technical"`
- **`CompletedEventEditSheet.tsx`** line 250: placeholder → `"e.g. Independent Inspector, LEAPS"`
- **`help-chat/index.ts`** line 158: → `NEVER mention "ADIPS", "PIPA", or "RPII" - use "Annual Inspection Certificate" or "Annual Independent Inspection" instead`

## 3. RA delete confirmation — `RiskItemCard.tsx`

Replace the bare trash button (lines 95-101) with an `AlertDialog`:
- Title: "Delete this risk item?"
- Description: "This will remove this hazard and its controls from this risk assessment."
- Cancel + destructive Continue button calling `onDelete`

## 4. Wind Log component — `WindSpeedLog.tsx`

Props: `rideId`, `rideName`

**Log list** — Card-based, each entry shows (in order): date, time, speed + unit, recorded by, location (if present). Anemometer details are secondary — shown only in an expandable/collapsible section per entry.

**Add Reading form** (Sheet/Dialog):
- Date (default today), Time (default now), Wind speed (numeric), Unit selector (mph / km/h / m/s, default mph)
- Recorded by, Location
- Collapsible "Anemometer Details": make, model, serial
- Action taken (optional), Notes (optional)

No enforcement logic — purely a recording tool.

## 5. RideDetail tab update

- Lazy-import `WindSpeedLog`, import `Wind` icon from lucide
- Determine `isInflatable = ride.ride_categories.category_group === 'Inflatables'`
- Build tabs array conditionally; append `{ value: 'windlog', label: 'Wind Log', Icon: Wind }` when inflatable
- **Mobile-safe layout**: When inflatable (5 tabs), switch `TabsList` from `grid grid-cols-4` to `flex w-full overflow-x-auto` with each trigger getting `flex-1 min-w-[72px]` so tabs scroll horizontally on narrow screens. Non-inflatable (4 tabs) keeps the existing grid layout.
- Add `<TabsContent value="windlog">` rendering `<WindSpeedLog />`

## File change summary

| Action | File |
|--------|------|
| Migration | New migration — 3 UPDATEs + CREATE TABLE + RLS |
| Edit | `MarkCompleteSheet.tsx` — placeholder text |
| Edit | `CompletedEventEditSheet.tsx` — placeholder text |
| Edit | `help-chat/index.ts` — system prompt |
| Edit | `RiskItemCard.tsx` — AlertDialog delete confirmation |
| Create | `WindSpeedLog.tsx` — wind log component |
| Edit | `RideDetail.tsx` — conditional Wind Log tab + mobile layout |

