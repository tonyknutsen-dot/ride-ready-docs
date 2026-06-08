/**
 * Helpers for the document preview lifecycle (server-generated PDF preview
 * for DOC/DOCX/XLS/XLSX). Keeps UI wording consistent across surfaces.
 *
 * NOTE: This file does NOT touch malware scanning, the upload allowlist,
 * the 3.4 MB beta cap, or quarantine logic — it is presentation-only and
 * a thin wrapper around the `generate-document-preview` edge function.
 */
import { supabase } from '@/integrations/supabase/client';

export type PreviewStatus =
  | 'pending'
  | 'ready'
  | 'failed'
  | 'not_supported'
  | 'not_required'
  | null
  | undefined;

const RETRYABLE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx']);

export function extOf(path?: string | null): string {
  if (!path) return '';
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

/** Whether a "Generate / Retry preview" action makes sense for this document. */
export function canRetryPreview(doc: {
  upload_status?: string | null;
  preview_status?: PreviewStatus;
  file_path?: string | null;
  original_filename?: string | null;
}): boolean {
  // Allow retry for clean uploads AND for legacy/generated docs that never
  // went through the scanner (upload_status null). Block only quarantined
  // or rejected uploads.
  if (doc.upload_status && doc.upload_status !== 'clean') return false;
  const e = extOf(doc.original_filename) || extOf(doc.file_path);
  if (!RETRYABLE_EXTS.has(e)) return false;
  const s = doc.preview_status ?? null;
  return s === null || s === 'failed' || s === 'not_supported';
}

/** Friendly UI label for the current preview state. */
export function previewStatusLabel(status: PreviewStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Preparing preview…';
    case 'failed':
    case 'not_supported':
      return 'Preview unavailable';
    case 'ready':
    case 'not_required':
    case null:
    case undefined:
    default:
      return null;
  }
}

export const PREVIEW_RETRY_FRIENDLY_ERROR =
  'Preview could not be created for this file. You can still download the original document.';

/** Invoke the edge function as the current authenticated user. */
export async function retryDocumentPreview(documentId: string): Promise<{ ok: boolean; status?: string }> {
  const { data, error } = await supabase.functions.invoke('generate-document-preview', {
    body: { documentId },
  });
  if (error) {
    // Never surface raw error details to the user.
    console.error('retryDocumentPreview error', error);
    return { ok: false };
  }
  return { ok: !!data?.ok, status: data?.status };
}
