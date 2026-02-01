

# Improving Document Email Delivery for Large Files

## Current Situation

Your current implementation is already solid with email splitting at 10MB (which aligns with Resend's 40MB limit with room for base64 encoding overhead). However, there are several enhancements we can make to provide a better experience when users need to share many large documents.

## Proposed Improvements

### Option 1: Secure Download Links (Recommended)

Instead of attaching files directly to emails, generate **time-limited secure download links** that allow recipients to download documents from Supabase Storage. This is the industry-standard approach for large file sharing.

**How it works:**
1. User selects documents to share
2. System creates a "document share" record in the database with a unique token
3. Email contains links to download each document (or a single link to a download page)
4. Links expire after a configurable period (e.g., 7 days)
5. Recipients click to download - no attachment size limits

**Benefits:**
- No size limits on individual files or total package size
- Single email regardless of how many documents
- Tracks who downloaded and when (audit trail)
- Can revoke access if needed
- Faster email delivery (smaller email size)
- Works reliably across all email clients

### Option 2: Hybrid Approach

Offer users the choice at send time:
- **Small packages** (under 10MB total): Send as attachments (current behaviour)
- **Large packages**: Automatically switch to download links with clear messaging

### Option 3: ZIP Compression

Before sending, compress all selected documents into a single ZIP file. This can reduce total size by 20-50% for many document types.

**Note:** PDFs and images are already compressed, so benefits are limited. Best for mixed document types.

---

## Recommended Implementation: Secure Download Links

### Database Changes

Create a new table to track document shares:

```text
document_shares
├── id (uuid, primary key)
├── user_id (uuid, references auth.users)
├── share_token (text, unique) - for URL generation
├── recipient_email (text)
├── recipient_name (text, nullable)
├── message (text, nullable)
├── created_at (timestamp)
├── expires_at (timestamp) - default 7 days
├── accessed_at (timestamp, nullable) - first access
├── access_count (integer, default 0)
├── is_revoked (boolean, default false)

document_share_items
├── id (uuid, primary key)
├── share_id (uuid, references document_shares)
├── document_id (uuid, references documents)
├── file_path (text) - copy for when original is deleted
├── document_name (text)
├── document_type (text)
└── created_at (timestamp)
```

### Edge Function Changes

**New edge function: `create-document-share`**
- Creates share record and generates secure token
- Generates signed URLs for each document (using Supabase `createSignedUrl`)
- Sends email with download links

**New edge function: `get-shared-documents`**
- Validates share token and expiry
- Returns document list with fresh signed download URLs
- Increments access counter

### Frontend Changes

1. **BatchSendDocuments page**: Add toggle for "Send as download links" (auto-enabled for large packages)
2. **Size estimation**: Show total size before sending with recommendation
3. **New public page**: `/shared/:token` - recipients land here to download

### Email Template

The email would include:
- Sender information (as today)
- Custom message
- List of included documents with individual download buttons
- "Download All" option if feasible
- Clear expiry notice ("These links expire on [date]")
- Contact information for the sender

---

## Technical Details

### Supabase Signed URLs

Supabase Storage supports signed URLs for private buckets:

```typescript
const { data } = await supabase.storage
  .from('ride-documents')
  .createSignedUrl(filePath, 604800); // 7 days in seconds
```

This generates a secure, time-limited URL that bypasses RLS but expires automatically.

### Security Considerations

- Share tokens are UUIDs + random suffix (cryptographically secure)
- All downloads logged for audit trail
- Shares can be revoked by the owner
- Configurable expiry (1-30 days)
- Rate limiting on download endpoint
- Optional: password protection for sensitive documents

### User Experience Flow

```text
User selects documents → Clicks "Send"
         ↓
System calculates total size
         ↓
    < 10MB?  ─────Yes───→ Current attachment flow
         ↓
        No
         ↓
"Documents too large for email attachments.
 Send as secure download links instead?"
         ↓
    [Send Links]
         ↓
Creates share record → Generates email → Sends
         ↓
Recipient clicks link → Downloads documents
```

---

## Summary

| Approach | Pros | Cons |
|----------|------|------|
| **Secure Links** | No size limits, better deliverability, audit trail | Requires internet access to download |
| **Hybrid** | Best of both, user choice | More complex UI |
| **ZIP** | Smaller emails | Limited benefit for PDFs, extra step for recipient |

**Recommendation:** Implement Option 1 (Secure Download Links) with automatic fallback to attachments for small packages (hybrid behaviour). This gives users the best experience without requiring manual decisions for most cases.

