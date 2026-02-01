
# Plan: Fix Staff Equipment Access and Improve Operator Warnings

## Problem Summary

Staff members cannot see any rides/equipment even when properly invited because:

1. **Client-side filtering blocks data**: Components like `RideSelector`, `Maintenance`, and `CalendarView` filter by `.eq('user_id', user.id)` which returns nothing for staff (they don't own the data)

2. **RLS policies are already correct**: The database function `staff_can_access_ride()` properly handles:
   - Staff with specific assignments see only those rides
   - Staff with NO assignments see ALL rides

3. **Operator warning could be clearer**: The current hint about equipment assignment is easy to miss

---

## Solution Overview

### Part 1: Update Components to Use Staff-Aware Data Fetching

Remove explicit `user_id` filters for staff members and let RLS policies control access.

| Component | Current Issue | Fix |
|-----------|---------------|-----|
| `RideSelector.tsx` | Filters by `user.id` | Use `effectiveUserId` pattern; skip filter for staff |
| `Maintenance.tsx` | Filters by `user.id` | Same approach |
| `CalendarView.tsx` | Filters by `user.id` in multiple queries | Same approach |
| `DocumentRideAssignmentDialog.tsx` | Filters by `user.id` | Same approach |
| Other components with ride queries | Same issue | Apply pattern consistently |

### Part 2: Improve Operator Warning About Equipment Access

Make it very clear that not selecting specific equipment grants full access:

**Current UI:**
```
Assign Equipment (Optional)
Leave empty to allow access to all your equipment
```

**Proposed UI:**
```
Restrict Equipment Access
┌─────────────────────────────────────────────┐
│ ⚠️ No equipment selected                    │
│ Staff will have access to ALL your          │
│ equipment. Select specific items below      │
│ to restrict their access.                   │
└─────────────────────────────────────────────┘
```

Also add a confirmation step when no equipment is selected.

---

## Technical Changes

### File: `src/components/RideSelector.tsx`

Add staff-aware data fetching:

```text
Before:
  .eq('user_id', user?.id)
  
After:
  // For staff, skip user_id filter - RLS handles access
  if (!isStaff) {
    query = query.eq('user_id', effectiveUserId);
  }
```

### File: `src/pages/Maintenance.tsx`

Same pattern for the ride loading query.

### File: `src/components/CalendarView.tsx`

Update all 6+ queries that filter by user_id.

### File: `src/components/StaffInviteDialog.tsx`

1. Change section label from "Assign Equipment (Optional)" to "Restrict Equipment Access"
2. Add prominent warning alert when no equipment is selected
3. Add confirmation when sending invite with no equipment selected

### Files to Update (Complete List)

| File | Priority | Description |
|------|----------|-------------|
| `src/components/RideSelector.tsx` | High | Used by Checks and other pages |
| `src/pages/Maintenance.tsx` | High | Direct ride loading |
| `src/components/CalendarView.tsx` | High | Multiple queries |
| `src/components/DocumentRideAssignmentDialog.tsx` | Medium | Ride assignment |
| `src/components/DailyCheckTemplateManager.tsx` | Medium | Template loading |
| `src/components/StaffInviteDialog.tsx` | High | Improve warning UI |
| `src/components/StaffEquipmentDialog.tsx` | Medium | Already has good warning |

---

## UI Changes for StaffInviteDialog

### Updated Equipment Section

```text
┌─────────────────────────────────────────────────────────┐
│ 📦 Equipment Access                                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ⚠️ FULL ACCESS                                      │ │
│ │ No equipment selected - this staff member will     │ │
│ │ be able to see and interact with ALL your rides,   │ │
│ │ generators, and equipment.                         │ │
│ │                                                     │ │
│ │ Select specific items below to restrict access.    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ☐ Waltzer                                              │
│ ☐ Dodgems                                              │
│ ☐ Generator 1                                          │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Confirmation Dialog (when no equipment selected)

When the operator clicks "Send Invitation" without selecting equipment:

```text
┌─────────────────────────────────────────────────────────┐
│ Confirm Full Access                                     │
│                                                         │
│ You haven't selected any specific equipment.            │
│                                                         │
│ This means staff@example.com will have access to        │
│ ALL 12 items in your equipment list.                    │
│                                                         │
│ Is this what you want?                                  │
│                                                         │
│        [Go Back]              [Yes, Grant Full Access]  │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

1. **Update RideSelector.tsx** - Add `useEffectiveUserId` and `useStaff`, conditionally skip user_id filter
2. **Update Maintenance.tsx** - Same pattern for ride loading
3. **Update CalendarView.tsx** - Apply to all queries
4. **Update StaffInviteDialog.tsx** - Add prominent warning and confirmation
5. **Update remaining components** - Apply pattern consistently
6. **Test as staff** - Verify rides appear correctly

---

## Testing Checklist

After implementation:
- [ ] Staff with NO assignments sees ALL operator's rides
- [ ] Staff with specific assignments sees only those rides
- [ ] Operator sees clear warning when no equipment is selected
- [ ] Operator gets confirmation dialog before granting full access
- [ ] Checks page works for staff
- [ ] Maintenance page works for staff
- [ ] Calendar page works for staff
