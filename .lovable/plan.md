
# Admin Audit & Support Access System

## Overview
This plan implements a comprehensive system for platform auditing and user-requested support access. It addresses the need for admin oversight while maintaining the privacy-first principles established in the Data Independence work.

---

## Current State Analysis

### What Exists
- `audit_logs` table with RLS allowing admins to view all logs
- `useAuditLog` hook logging document views, downloads, shares, exports
- User-facing `ActivityLog` component showing personal activity
- Login/logout action types defined but **not being recorded**
- Security Dashboard exists but focuses on rate limiting/IP blocking, not audit logs

### What's Missing
1. **Login/logout events not logged** - AuthContext doesn't call the audit hook
2. **No admin UI** to browse platform-wide audit logs
3. **No support access mechanism** - admin cannot view user documents even when needed
4. **No session tracking** - who logged in when, from where

---

## Implementation Plan

### Phase 1: Login/Logout Audit Logging

**File: `src/contexts/AuthContext.tsx`**

Add audit logging for authentication events:
- Log `login` action when `signInWithPassword` succeeds
- Log `logout` action when `signOut` is called
- Include IP address and user agent in details when possible

```text
Changes:
- Import and use logEvent from useAuditLog (via supabase RPC directly since hooks can't be used in context)
- After successful login: call log_audit_event RPC with action='login', resource_type='session'
- Before signOut: call log_audit_event RPC with action='logout', resource_type='session'
```

---

### Phase 2: Admin Audit Log Viewer

**New File: `src/pages/admin/AuditLogs.tsx`**

A dedicated admin page to view all platform audit activity with:

**Features:**
- Filterable by action type (login, logout, view, download, share, export)
- Filterable by resource type (session, document, check, defect, etc.)
- Searchable by user (shows email from profiles join)
- Date range filter
- Sortable by timestamp
- Pagination (50 entries per page)

**UI Components:**
- Stats cards: Total events (24h), Unique users (24h), Document accesses, Failed logins
- Filter bar with dropdowns for action, resource type, date range
- Data table with columns: Timestamp, User, Action, Resource, Details, IP Address

**Security:**
- Uses existing RLS policy: "Admins can view all audit logs"
- No document content is exposed - only metadata (file names, action types)

---

### Phase 3: User-Requested Support Access

**New Database Table: `support_access_grants`**

```sql
CREATE TABLE support_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_to_admin UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_scope TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
-- Users can view and revoke their own grants
-- Admins can view all grants
-- Only the granting user can create a grant
```

**New Component: `src/components/SupportAccessManager.tsx`**

For users (in Settings):
- "Request Support Access" button
- Shows active grants with expiry countdown
- "Revoke Access" button to immediately end a grant

**New Admin Component: `src/components/admin/ActiveSupportGrants.tsx`**

For admins:
- List of active support grants
- Shows which user granted access and why
- When admin has an active grant, document links become viewable for that user only

**Workflow:**
1. User contacts support with an issue
2. User clicks "Grant Support Access" in Settings
3. User enters reason and selects duration (1hr, 24hr, 7 days)
4. Admin sees the grant in Admin Panel
5. Admin can now view (read-only) that specific user's documents
6. All admin views are logged to audit_logs with `action='support_view'`
7. Access automatically expires or user revokes manually

---

### Phase 4: Integration & Navigation

**File: `src/components/admin/AdminLayout.tsx`**

Add navigation item:
```text
{ name: 'Audit Logs', href: '/admin/audit-logs', icon: History, count: 0 }
```

**File: `src/App.tsx`**

Add route:
```text
/admin/audit-logs -> AuditLogs component (AdminRoute protected)
```

**File: `src/pages/Settings.tsx`**

Add "Support Access" section:
- Shows current active grants (if any)
- Button to grant temporary access
- Privacy reminder about what this does

---

## Database Migration

```sql
-- Support access grants table
CREATE TABLE public.support_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  granted_to_admin UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_scope TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'revoked'))
);

-- Enable RLS
ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own grants"
  ON public.support_access_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own grants"
  ON public.support_access_grants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own grants"
  ON public.support_access_grants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'revoked');

CREATE POLICY "Admins can view all grants"
  ON public.support_access_grants FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Function to check if admin has active support access
CREATE OR REPLACE FUNCTION public.admin_has_support_access(_admin_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE granted_to_admin = _admin_id
      AND user_id = _user_id
      AND status = 'active'
      AND expires_at > now()
  )
$$;

-- Auto-expire grants (for scheduled cleanup)
CREATE OR REPLACE FUNCTION public.expire_support_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.support_access_grants
  SET status = 'expired'
  WHERE status = 'active' AND expires_at <= now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/AuditLogs.tsx` | Admin audit log viewer with filters |
| `src/components/admin/AuditLogTable.tsx` | Reusable table component for audit logs |
| `src/components/SupportAccessManager.tsx` | User-facing support access UI |
| `src/components/admin/ActiveSupportGrants.tsx` | Admin view of active grants |

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Add login/logout audit logging |
| `src/components/admin/AdminLayout.tsx` | Add "Audit Logs" navigation |
| `src/App.tsx` | Add `/admin/audit-logs` route |
| `src/pages/Settings.tsx` | Add Support Access section |
| `src/pages/admin/SecurityDashboard.tsx` | Add link to Audit Logs |

---

## Security Considerations

1. **Audit logs never expose document content** - only filenames and action types
2. **Support access is always user-initiated** - admin cannot request access
3. **All support views are logged** - creates accountability
4. **Time-limited by design** - grants auto-expire
5. **User can revoke instantly** - maintains control
6. **Scope is read-only** - admin cannot modify user data

---

## Trust Statement Addition

Update the Data Independence page to include:

> **Support Access**: If you ever need help with your account, you can grant us temporary, time-limited access to troubleshoot. This access is:
> - Only granted when you explicitly request it
> - Logged in your activity history
> - Automatically expires after the time you choose
> - Revocable by you at any time

---

## Summary

This implementation provides:
1. Complete audit trail of all login/logout events
2. Admin visibility into platform activity (without document content access)
3. User-controlled support access mechanism with full transparency
4. All access is logged, time-limited, and revocable

The system maintains the privacy-first approach while enabling legitimate support and auditing needs.
