/**
 * Client-side upload validation.
 * Mirrored server-side in supabase/functions/validate-and-scan-document.
 * This is a UX guard ONLY — the server re-validates every byte.
 */

// Extended beta allowlist:
//  - PDF + images preview directly in-app
//  - Word/Excel formats are scanned, then converted server-side to a PDF preview
export const ALLOWED_DOC_EXTENSIONS = [
  'pdf',
  'docx', 'doc', 'rtf', 'odt',
  'xlsx', 'xls', 'csv', 'ods',
  'png', 'jpg', 'jpeg', 'webp',
] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

export const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  // Word / RTF / ODT
  'application/msword',                                                                  // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',             // .docx
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument.text',                                             // .odt
  // Excel / CSV / ODS
  'application/vnd.ms-excel',                                                            // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',                   // .xlsx
  'application/vnd.oasis.opendocument.spreadsheet',                                      // .ods
  'text/csv',
  'application/csv',
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const DOC_ACCEPT_ATTR =
  '.pdf,.docx,.doc,.rtf,.odt,.xlsx,.xls,.csv,.ods,.png,.jpg,.jpeg,.webp';
export const IMAGE_ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

// Hard cap shared with server-side validator (validate-and-scan-document)
// Beta limit — matches current Cloudmersive free-tier constraint.
export const MAX_DOC_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB
export const MAX_IMAGE_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB

/** User-facing copy for the beta upload size limit. */
export const BETA_UPLOAD_SIZE_NOTICE =
  'Maximum file size is 3.4 MB during beta. Larger file support will be added before wider release.';

/** Friendly preview guidance shown on the upload screen. */
export const UPLOAD_PREVIEW_NOTICE =
  'PDF and image files can be previewed directly. Word and Excel files will be converted to a PDF preview where supported. The original file remains available to download.';

/** Macro-enabled Office formats blocked during beta. */
const MACRO_EXTENSIONS = new Set(['docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'pptm']);

const MACRO_REJECTION_MSG =
  'This file type is not currently allowed. Please upload a PDF, Word document, Excel file, image, or a non-macro Office file.';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  sanitizedName?: string;
}

/** Remove path separators, control chars, and limit length. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, '_').trim();
  return cleaned.slice(0, 180) || 'file';
}

function extensionsFromName(name: string): string[] {
  const parts = name.toLowerCase().split('.');
  if (parts.length < 2) return [];
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

  const finalExt = exts[exts.length - 1];

  // Macro-enabled Office files blocked regardless of mode
  if (MACRO_EXTENSIONS.has(finalExt)) {
    return { ok: false, reason: MACRO_REJECTION_MSG };
  }

  const allowed = opts.mode === 'image' ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_DOC_EXTENSIONS;
  if (!allowed.includes(finalExt as never)) {
    if (opts.mode === 'image') {
      return { ok: false, reason: 'Only JPG, PNG and WEBP files are supported here.' };
    }
    return {
      ok: false,
      reason:
        'This file type is not currently supported. Please upload a PDF, Word, Excel, CSV, or image file.',
    };
  }

  // Reject double extensions with risky/macro intermediates (e.g. invoice.docm.pdf)
  if (exts.length > 1) {
    const RISKY = new Set([
      'exe', 'msi', 'bat', 'cmd', 'scr', 'ps1', 'sh', 'js', 'html', 'htm', 'php',
      'svg', 'zip', 'rar', '7z', 'jar', 'vbs', 'wsf',
      // Macro-enabled forms anywhere in the chain
      'docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'pptm',
    ]);
    for (let i = 0; i < exts.length - 1; i++) {
      if (RISKY.has(exts[i])) {
        return { ok: false, reason: MACRO_REJECTION_MSG };
      }
    }
  }

  const allowedMimes = opts.mode === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_DOC_MIMES;
  // Some browsers report blank MIME for csv/rtf/odt — tolerate empty, reject only known-bad
  if (file.type && !allowedMimes.has(file.type)) {
    // Allow common variants the browser might send
    const tolerated =
      (finalExt === 'csv' && file.type.startsWith('text/')) ||
      (finalExt === 'rtf' && file.type.includes('rtf')) ||
      (finalExt === 'odt' && file.type.includes('opendocument')) ||
      (finalExt === 'ods' && file.type.includes('opendocument'));
    if (!tolerated) {
      return { ok: false, reason: 'This file type is not currently supported.' };
    }
  }

  const maxBytes = opts.mode === 'image' ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
  if (file.size > maxBytes) {
    return { ok: false, reason: BETA_UPLOAD_SIZE_NOTICE };
  }

  if (file.size === 0) {
    return { ok: false, reason: 'This file is empty.' };
  }

  return { ok: true, sanitizedName: sanitized };
}

/** Office formats that need server-side conversion to a PDF preview. */
export const OFFICE_PREVIEW_EXTENSIONS = new Set([
  'docx', 'doc', 'rtf', 'odt',
  'xlsx', 'xls', 'csv', 'ods',
]);
