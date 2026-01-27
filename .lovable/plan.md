
# Staff Management System

## Overview

This plan implements a complete staff management system where owners can invite staff members via email to perform checks, maintenance, or access specific equipment. Staff will have their own accounts with restricted access based on their assigned permissions.

---

## How It Works

### For You (The Owner)

1. Go to a new "Staff" section in Settings or the sidebar
2. Click "Invite Staff Member"
3. Enter their email address
4. Choose their permission level:
   - **Checks Only** - Can perform pre-opening, daily, monthly, yearly checks
   - **Checks + Maintenance** - Can also log maintenance activities
   - **Full Access** - Can view documents, checks, maintenance, everything except billing
5. Optionally assign them to specific rides (or leave blank for all rides)
6. They receive an invite email and create their account

### For Your Staff

1. They receive an invite email with a button "Join [Your Company Name]"
2. They create an account (or sign in if they already have one)
3. They see a simplified version of the app showing only what they're allowed to access
4. They can only see/work with the rides you've assigned to them

---

## What Staff See

When a staff member logs in, they see a streamlined interface:

| Permission Level | What They See |
|-----------------|---------------|
| **Checks Only** | Overview (simplified), Rides, Checks, Calendar |
| **Checks + Maintenance** | Above + Maintenance section |
| **Full Access** | Above + Documents, Risk Assessments, Send Documents |

**Always Hidden from Staff:**
- Plan & Billing
- Staff Management
- Admin features
- Settings (except their own profile)

---

## Database Changes

### New Tables

**`organisations`** - Groups users together
```text
id, name, owner_id, created_at, settings
```

**`organisation_members`** - Staff linked to organisations
```text
id, organisation_id, user_id, permission_level, invited_by, 
joined_at, is_active
```

**`staff_equipment_assignments`** - Which rides staff can access
```text
id, member_id, ride_id, assigned_at, assigned_by
```

**`staff_invites`** - Pending invitations (mirrors tester_invites pattern)
```text
id, organisation_id, email, permission_level, 
invite_token, invited_by, status, expires_at, accepted_at
```

### New Enum

**`staff_permission`**
```text
checks_only | checks_maintenance | full_access
```

### Row Level Security

All existing tables (rides, checks, documents, etc.) will have their RLS policies updated to allow staff to access records for their assigned rides only:

```sql
-- Example: Staff can view rides assigned to them OR if they're the owner
CREATE POLICY "Users and staff can view assigned rides"
ON public.rides FOR SELECT USING (
  user_id = auth.uid() 
  OR 
  id IN (
    SELECT ride_id FROM staff_equipment_assignments sea
    JOIN organisation_members om ON sea.member_id = om.id
    WHERE om.user_id = auth.uid() AND om.is_active = true
  )
);
```

---

## Frontend Changes

### New Components

**`StaffManagement.tsx`** - Page where owners manage their staff
- List current staff with their permissions
- Invite new staff button
- Edit permissions / equipment assignments
- Remove staff access

**`StaffInviteDialog.tsx`** - Dialog to send invitations
- Email input
- Permission level selector
- Equipment assignment (optional)

**`StaffInvite.tsx`** - Page where invited staff accept (like TesterInvite.tsx)
- Validates invite token
- Allows sign up or sign in
- Links staff to organisation

**`StaffContext.tsx`** - React context for permission checking
- Tracks if current user is staff vs owner
- Provides permission level
- Used to conditionally show/hide UI elements

**`StaffRoute.tsx`** - Protected route component
- Blocks access to routes staff shouldn't see
- Redirects to overview if accessed

### Modified Components

**`AppSidebar.tsx`** - Updated navigation
- Conditionally hide items based on permission level
- Hide "Staff" section from staff users
- Hide billing from staff

**`RideManagement.tsx`** - Filter rides for staff
- Only show assigned rides to staff
- Show all rides to owners

---

## Edge Functions

### `send-staff-invite`
- Owner sends invite
- Creates invite record
- Sends branded email with join link

### `accept-staff-invite`
- Validates token
- Creates account if needed
- Links user to organisation
- Assigns equipment

### `register-staff`
- Creates new account with pre-confirmed email
- Similar to existing register-tester function

---

## Implementation Order

### Phase 1: Database Foundation
1. Add `staff_permission` enum
2. Create `organisations` table
3. Create `organisation_members` table
4. Create `staff_equipment_assignments` table
5. Create `staff_invites` table
6. Add RLS policies for all new tables

### Phase 2: Auto-Create Organisation
1. Trigger to create organisation for existing users with rides
2. Set owner_id on organisation

### Phase 3: Staff Invite Flow
1. Create `send-staff-invite` edge function
2. Create `register-staff` edge function  
3. Create `accept-staff-invite` edge function
4. Create `StaffInvite.tsx` page
5. Add route `/staff-invite/:token`

### Phase 4: Staff Management UI
1. Create `StaffContext.tsx`
2. Create `StaffManagement.tsx` page
3. Create `StaffInviteDialog.tsx`
4. Add "Staff" to sidebar (owners only)

### Phase 5: Permission Enforcement
1. Create `useStaffPermissions` hook
2. Update `AppSidebar.tsx` with permission checks
3. Create `StaffRoute.tsx` component
4. Update route protection

### Phase 6: Equipment Filtering
1. Update ride queries to filter by assignment
2. Update check queries to filter by assignment
3. Update maintenance queries to filter by assignment

---

## Email Template

Staff will receive an email like:

```text
Subject: You're invited to join [Company Name] on Ride Ready Docs

Hi,

[Controller Name] has invited you to join their team on Ride Ready Docs.

As a staff member, you'll be able to:
- Perform safety checks on assigned equipment
- Log maintenance activities (if permitted)
- Access documents (if permitted)

[Accept Invitation Button]

This invite expires in 7 days.
```

---

## Security Considerations

1. **Role separation**: Staff role is separate from the existing `app_role` enum - this is an organisation-level membership, not an app-level role
2. **Equipment scoping**: All database queries scoped to assigned equipment via RLS
3. **Audit trail**: Staff actions tracked with their user_id
4. **Owner control**: Only owners can invite, remove, or modify staff permissions
5. **Invite expiry**: Invites expire after 7 days

---

## Future Considerations (Not in Scope)

- **Offline mode**: Requires PWA implementation (separate feature)
- **Multi-organisation staff**: Staff working for multiple operators
- **Staff seat limits**: Adding billing for number of staff
- **Activity logging**: Detailed audit log of staff actions

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/contexts/StaffContext.tsx` | Permission checking context |
| `src/components/StaffManagement.tsx` | Staff management page |
| `src/components/StaffInviteDialog.tsx` | Invite dialog |
| `src/components/StaffRoute.tsx` | Permission-gated routing |
| `src/pages/StaffInvite.tsx` | Accept invitation page |
| `src/hooks/useStaffPermissions.tsx` | Permission utilities |
| `supabase/functions/send-staff-invite/index.ts` | Send invite |
| `supabase/functions/register-staff/index.ts` | Register staff |
| `supabase/functions/accept-staff-invite/index.ts` | Accept invite |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppSidebar.tsx` | Add Staff nav, permission filtering |
| `src/App.tsx` | Add staff routes |
| `supabase/config.toml` | Add new edge functions |

---

## Summary

This implementation adds a complete staff management system where:

1. **Owners invite staff** via email with chosen permissions
2. **Staff create accounts** using the invite link
3. **Staff see a restricted UI** based on their permission level
4. **Staff only access assigned rides** (or all rides if none specified)
5. **All data is secured** via Row Level Security policies

The architecture mirrors the existing tester invite system you already have, making it familiar and consistent.
