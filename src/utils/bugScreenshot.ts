import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'bug-attachments';
const SIGN_EXPIRES_SECONDS = 60 * 60; // 1 hour

/**
 * Extracts the storage path inside the bug-attachments bucket from either
 * a raw storage path ("userId/timestamp.png") or a legacy public/sign URL
 * containing "/bug-attachments/". Returns null if it isn't a bucket asset.
 */
export function extractBugAttachmentPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const s = stored.trim();
  if (!s) return null;

  // Legacy: full URL pointing at the bucket
  const marker = `/${BUCKET}/`;
  const idx = s.indexOf(marker);
  if (idx !== -1) {
    const tail = s.slice(idx + marker.length);
    // Strip any query string
    return tail.split('?')[0] || null;
  }

  // If it looks like an external URL (http/https) that isn't our bucket, return null
  if (/^https?:\/\//i.test(s)) return null;

  // Otherwise treat as a raw storage path
  return s;
}

/**
 * Resolve a stored screenshot reference to a viewable URL.
 * - Bucket paths / legacy bucket URLs → fresh signed URL.
 * - External URLs (manually pasted) → returned as-is.
 * Returns null if nothing usable or signing failed.
 */
export async function resolveBugScreenshotUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const s = stored.trim();
  if (!s) return null;

  const path = extractBugAttachmentPath(s);
  if (!path) {
    // External URL (not our bucket)
    return /^https?:\/\//i.test(s) ? s : null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_EXPIRES_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn('Failed to sign bug screenshot URL', error);
    return null;
  }
  return data.signedUrl;
}
