/**
 * Client-side upload validation.
 * Mirrored server-side in supabase/functions/validate-and-scan-document.
 * This is a UX guard ONLY — the server re-validates every byte.
 */

export const ALLOWED_DOC_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'webp'] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

export const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const DOC_ACCEPT_ATTR = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp';
export const IMAGE_ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

// Hard cap shared with server-side validator (validate-and-scan-document)
export const MAX_DOC_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB
export const MAX_IMAGE_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  sanitizedName?: string;
}

/** Remove path separators, control chars, and limit length. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  // Strip control chars and disallow leading dots / spaces
  const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, '_').trim();
  return cleaned.slice(0, 180) || 'file';
}

function extensionsFromName(name: string): string[] {
  const parts = name.toLowerCase().split('.');
  if (parts.length < 2) return [];
  // Drop the bare filename, keep all extensions
  return parts.slice(1);
}

export interface ValidateOptions {
  mode: 'document' | 'image';
}

export function validateClientFile(file: File, opts: ValidateOptions): ValidationResult {
  const sanitized = sanitizeFilename(file.name);
  const exts = extensionsFromName(sanitized);

  if (exts.length === 0) {
    return { ok: false, reason: 'This file type is not currently supported.' };
  }

  // Reject double extensions like document.pdf.exe
  const allowed = opts.mode === 'image' ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_DOC_EXTENSIONS;
  const finalExt = exts[exts.length - 1];
  if (!allowed.includes(finalExt as never)) {
    return { ok: false, reason: 'Only PDF, DOCX, XLSX, JPG, PNG and WEBP files are currently supported.' };
  }

  // If there is an intermediate extension that's executable-looking, block
  if (exts.length > 1) {
    const RISKY = new Set(['exe','msi','bat','cmd','scr','ps1','sh','js','html','htm','php','svg','zip','rar','7z','docm','xlsm','pptm','jar','vbs','wsf']);
    for (let i = 0; i < exts.length - 1; i++) {
      if (RISKY.has(exts[i])) {
        return { ok: false, reason: 'This file type is not allowed.' };
      }
    }
  }

  const allowedMimes = opts.mode === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_DOC_MIMES;
  if (file.type && !allowedMimes.has(file.type)) {
    return { ok: false, reason: 'This file type is not currently supported.' };
  }

  const maxBytes = opts.mode === 'image' ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
  if (file.size > maxBytes) {
    return { ok: false, reason: `File is too large. Maximum is 3.4 MB.` };
  }

  if (file.size === 0) {
    return { ok: false, reason: 'This file is empty.' };
  }

  return { ok: true, sanitizedName: sanitized };
}
