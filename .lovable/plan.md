
# Early Access Email Signup for Coming Soon Page

## Overview
Add an email signup form to the Coming Soon landing page so potential users can join a waitlist for early access. When someone signs up, they'll receive a confirmation email, and you'll be notified of the new signup.

---

## What Users Will See

### Before
- Coming Soon page with feature preview and sign-in button only

### After
- **Email signup section** with:
  - Clear "Get Early Access" heading
  - Email input with validation and typo detection
  - Optional name field
  - Submit button with loading state
  - Success confirmation message
  - Privacy-friendly text (e.g., "We'll only email you about launch updates")

---

## Visual Design

The signup form will appear prominently above the existing "Already have an account?" section, styled as an attractive card with:
- Accent-coloured border to draw attention
- Mail icon for visual clarity
- Matches existing card styling from the page

---

## How It Works

```text
User Flow:
+-------------------+     +-----------------+     +------------------+
| User enters email | --> | Validate & save | --> | Show success msg |
+-------------------+     +-----------------+     +------------------+
                                  |
                                  v
                          +---------------+
                          | Send emails:  |
                          | - Confirm to  |
                          |   user        |
                          | - Notify you  |
                          +---------------+
```

---

## Technical Details

### 1. Database Table (New)
Create a dedicated `early_access_signups` table:
- `id` (UUID, primary key)
- `email` (text, required, unique)
- `name` (text, optional)
- `created_at` (timestamp)
- `source` (text, default "coming_soon")

**Why a separate table?** The existing `marketing_contacts` table requires a `user_id`, which unauthenticated visitors don't have.

### 2. Edge Function (New): `early-access-signup`
- Accepts email and optional name
- Validates email format
- Checks for duplicates (friendly message if already signed up)
- Stores in database
- Sends confirmation email to user
- Sends notification email to you (info@ridereadydocs.com)
- Rate-limited to prevent abuse
- Honeypot field for bot detection

### 3. Frontend Component
- Simple inline form (not a dialog)
- Uses existing Input, Button, Label components
- Email typo detection using existing `getEmailSuggestion` utility
- Loading and success states
- Mobile-responsive design

### 4. Security Measures
- Rate limiting (using existing shared rate-limiter)
- Email validation (both client and server)
- Honeypot field for bots
- RLS policy allowing public inserts only (no reads/updates)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/ComingSoon.tsx` | Modify | Add email signup form |
| `supabase/functions/early-access-signup/index.ts` | Create | Handle signups and send emails |
| Database migration | Create | Add `early_access_signups` table with RLS |

---

## Confirmation Email Design

The confirmation email will match your existing brand style:
- Branded header with gradient
- Thank you message
- Expectation setting ("We'll notify you when we launch")
- Professional footer

---

## Admin Notification

You'll receive an email at info@ridereadydocs.com whenever someone signs up, including:
- Their email address
- Their name (if provided)
- Timestamp
- Total signup count

This lets you monitor interest without needing to check the database.
