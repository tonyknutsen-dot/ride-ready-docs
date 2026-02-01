
# Plan: Fix Staff Data Access and Upgrade Prompt Display

## Problem Summary

When staff members log in, they see empty data (0 rides, 0 documents, etc.) despite having proper RLS policies configured. This occurs because:

1. **Client-side filtering blocks results**: Every data query includes `.eq('user_id', user.id)` where `user.id` is the logged-in staff member's ID
2. **Data belongs to the organization owner**: All rides, documents, checks, etc. have `user_id` set to the owner's ID, not the staff member's
3. **RLS policies are correct**: The database allows staff to see owner data via `staff_can_access_ride()` function, but client queries filter it out before RLS can help

Additionally, staff members should see upgrade prompts as **disabled** (not hidden or clickable) when features are locked.

---

## Solution Overview

### Phase 1: Create an "Effective User ID" Helper

Introduce a centralized way to determine whose data should be fetched:
- **Owners**: Use their own `user.id`
- **Staff**: Use the organization `ownerId` from `StaffContext`

This will be provided via a new hook `useEffectiveUserId()` that components and data hooks can consume.

### Phase 2: Update Data Fetching Hooks

Modify data-fetching code to conditionally remove `user_id` filters for staff members, allowing RLS policies to control access:

**Core Files to Update:**

| File | Change |
|------|--------|
| `src/hooks/useOverviewData.tsx` | Use effective user ID for all counts and recent activity |
| `src/pages/Rides.tsx` | Remove `.eq('user_id', user?.id)` for staff; let RLS handle it |
| `src/pages/Documents.tsx` | Same approach |
| `src/components/DocumentList.tsx` | Same approach |
| `src/components/RideDetail.tsx` | Same approach |
| `src/pages/RideDetailPage.tsx` | Remove owner check in query |

**Strategy:**

For staff members, queries will either:
- Remove the `user_id` filter entirely (relying on RLS)
- Or use the owner's ID if needed for profile-type queries

### Phase 3: Update Upgrade Prompts for Staff

Modify UI components to show **disabled** upgrade buttons for staff instead of functional ones:

| Component | Change |
|-----------|--------|
| `src/components/UpgradePrompt.tsx` | Show disabled button with "Ask owner to upgrade" text |
| `src/components/ItemLimitWarning.tsx` | Hide or show disabled version for staff |
| `src/pages/Overview.tsx` | Ensure staff see disabled "Upgrade" buttons on locked features |

---

## Technical Details

### New Hook: `useEffectiveUserId`

```text
File: src/hooks/useEffectiveUserId.tsx

Purpose:
- Returns { effectiveUserId, isStaff } 
- For owners: effectiveUserId = user.id
- For staff: effectiveUserId = staffMembership.ownerId
- Used by data hooks to know whose data to fetch
```

### Data Query Changes

**Example for Rides Page:**

Before (staff sees nothing):
```typescript
.from('rides')
.select(...)
.eq('user_id', user?.id)  // Staff's ID = 0 results
```

After (staff sees assigned rides via RLS):
```typescript
// For staff: don't filter by user_id, let RLS handle it
let query = supabase.from('rides').select(...);
if (!isStaff) {
  query = query.eq('user_id', user?.id);
}
// RLS policy "Staff can view assigned rides" kicks in for staff
```

### Upgrade Prompt UI Change

Staff will see:
- Upgrade button is **grayed out / disabled**
- Text says "Ask your company admin to upgrade"
- Button does not navigate to billing

---

## File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `src/hooks/useEffectiveUserId.tsx` | **NEW** | Helper hook for effective user ID |
| `src/hooks/useOverviewData.tsx` | Edit | Use effective user ID; remove user_id filter for staff |
| `src/pages/Rides.tsx` | Edit | Remove user_id filter for staff |
| `src/pages/Documents.tsx` | Edit | Remove user_id filter for staff |
| `src/pages/RideDetailPage.tsx` | Edit | Remove owner check in query for staff |
| `src/components/DocumentList.tsx` | Edit | Remove user_id filter for staff |
| `src/components/RideDetail.tsx` | Edit | Remove user_id filter for staff |
| `src/components/UpgradePrompt.tsx` | Edit | Show disabled button for staff |
| `src/components/ItemLimitWarning.tsx` | Edit | Hide for staff or show read-only message |
| `src/components/FeatureGate.tsx` | Edit | Pass staff context to fallback components |

---

## Testing Checklist

After implementation, verify:
1. Staff member can see company rides on /rides page
2. Staff member can see company documents on /documents page
3. Staff member can see stats (ride count, document count) on /overview
4. Locked features show disabled "Upgrade" buttons with appropriate messaging
5. Owner still sees full data and functional upgrade buttons
6. Staff cannot access billing or settings pages
