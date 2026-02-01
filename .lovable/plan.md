

# Integrate Early Access Signups with Marketing

## Overview
Add functionality to import early access signups directly into your marketing contacts list, enabling you to include these warm leads in email campaigns.

---

## What You'll Get

### On the Admin Early Access Page
- **"Add to Marketing"** button for individual signups
- **"Import All to Marketing"** bulk action button
- Visual indicator showing which signups have already been imported
- Automatic "early-access" tag applied to imported contacts

### Result
Early access signups become usable marketing contacts that can receive your campaigns, while still being tracked separately in admin for analytics.

---

## User Flow

```text
Early Access Admin Page
┌─────────────────────────────────────────────────────┐
│ Email: tony@example.com                             │
│ Name: Tony K                                        │
│ Source: coming_soon                                 │
│                                                     │
│ [✓ In Marketing List]  or  [Add to Marketing →]    │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │ marketing_contacts    │
               │ - email: tony@...     │
               │ - name: Tony K        │
               │ - tags: [early-access]│
               │ - user_id: YOUR_ID    │
               └───────────────────────┘
                           │
                           ▼
                  Can receive campaigns!
```

---

## Technical Implementation

### 1. Update Early Access Admin Page (`src/pages/admin/EarlyAccessSignups.tsx`)

**New Features:**
- Fetch marketing contacts to check which emails are already imported
- Add "Add to Marketing" button per signup row
- Add "Import All New" bulk action in header
- Show "Already in list" badge for imported contacts

**Import Logic:**
```text
For each signup:
1. Check if email exists in marketing_contacts
2. If not, insert with:
   - email, name from signup
   - tags: ["early-access"]
   - user_id: admin's ID (fetched from your profile or passed in)
3. Show success/skip counts
```

### 2. Edge Function (New): `import-early-access-to-marketing`

Creates a server-side function to handle the import securely:
- Accepts array of signup IDs to import
- Validates admin role
- Inserts to marketing_contacts with proper user_id
- Returns success/duplicate/error counts

**Why an edge function?** 
The `marketing_contacts` table requires a `user_id` and has RLS. Since admin is viewing early access signups (which don't have user_id), we need server-side logic to properly assign ownership.

### 3. Track Import Status

Add a new column to `early_access_signups`:
- `imported_to_marketing_at` (timestamp, nullable)
- Set when successfully imported
- Allows showing status in admin UI

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/admin/EarlyAccessSignups.tsx` | Modify | Add import buttons, status indicators |
| `supabase/functions/import-early-access-to-marketing/index.ts` | Create | Handle secure import with proper user_id |
| Database migration | Create | Add `imported_to_marketing_at` column |

---

## UI Changes

### Desktop Table Row (After)
```text
┌─────────────────────────────────────────────────────────────────────┐
│ Email             │ Name   │ Source      │ Signed Up     │ Actions │
├───────────────────┼────────┼─────────────┼───────────────┼─────────┤
│ tony@example.com  │ Tony K │ coming_soon │ 01 Feb 2026   │ [Add →] │
│ jane@example.com  │ Jane   │ coming_soon │ 30 Jan 2026   │ ✓ Added │
└─────────────────────────────────────────────────────────────────────┘
```

### Header Actions (After)
```text
[Refresh] [Export CSV] [Import All New to Marketing]
```

---

## Imported Contacts

When imported, contacts will appear in your Marketing page with:
- **Tag**: `early-access` (for easy filtering/segmentation)
- **Notes**: "Imported from early access signup"
- **Subscribed**: Yes (default)

You can then:
- Include them in campaigns
- Add additional tags
- Track engagement

---

## Alternative Considered

**Auto-sync on signup**: Could automatically add to marketing_contacts when someone signs up. However, this requires knowing which admin user should "own" the contact, making it more complex for multi-admin setups. The manual import approach gives you control and works cleanly.

