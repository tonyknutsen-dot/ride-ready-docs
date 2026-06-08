import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Must mirror src/lib/uploadValidation.ts
const ALLOWED_EXTS = new Set([
  'pdf',
  'docx', 'doc', 'rtf', 'odt',
  'xlsx', 'xls', 'csv', 'ods',
  'png', 'jpg', 'jpeg', 'webp',
]);

// Macro-enabled formats explicitly blocked (even if user renames)
const MACRO_EXTS = new Set(['docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'pptm']);

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'application/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const OFFICE_PREVIEW_EXTS = new Set(['docx', 'doc', 'rtf', 'odt', 'xlsx', 'xls', 'csv', 'ods']);

const MAX_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB

interface ScanRequest {
  documentId: string;
}

async function checkUserRateLimit(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('check_rate_limit', {
      p_key: `upload-scan:${userId}:hour`,
      p_max_requests: 60,
      p_window_ms: 60 * 60 * 1000,
    });
    if (data && data.allowed === false) return false;

    const { data: dayData } = await supabase.rpc('check_rate_limit', {
      p_key: `upload-scan:${userId}:day`,
      p_max_requests: 300,
      p_window_ms: 24 * 60 * 60 * 1000,
    });
    return !(dayData && dayData.allowed === false);
  } catch {
    return true;
  }
}

function fileExt(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Magic-byte sniff. Returns a coarse category we can cross-check against
 * the extension. CSV/RTF/text formats have weak signatures so we return
 * 'text' rather than rejecting.
 */
function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // WEBP
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // ZIP container (docx/xlsx/odt/ods): PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return 'application/zip';
  // Legacy OLE compound (doc/xls): D0 CF 11 E0 A1 B1 1A E1
  if (bytes.length >= 8 &&
      bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 &&
      bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1) return 'application/x-ole-storage';
  // RTF: "{\rtf"
  if (bytes[0] === 0x7B && bytes[1] === 0x5C && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66) return 'application/rtf';
  return null;
}

function isPlausibleText(bytes: Uint8Array): boolean {
  // Sample first 512 bytes; >= 95% printable / whitespace
  const sample = bytes.subarray(0, Math.min(512, bytes.length));
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0A || b === 0x0D || (b >= 0x20 && b <= 0x7E) || b >= 0x80) printable++;
  }
  return sample.length === 0 || printable / sample.length >= 0.9;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PUBLIC_REJECT_MSG = 'This document could not be verified and has been blocked.';
const PUBLIC_TYPE_MSG = 'This file type is not allowed.';
const PUBLIC_MACRO_MSG =
  'This file type is not currently allowed. Please upload a PDF, Word document, Excel file, image, or a non-macro Office file.';

async function rejectDocument(
  supabase: any,
  doc: any,
  reason: string,
  detectedMime: string | null,
  publicReason: string,
) {
  try {
    if (doc.file_path) await supabase.storage.from('ride-documents').remove([doc.file_path]);
  } catch (e) {
    console.error('Failed to remove rejected object', e);
  }

  await supabase
    .from('documents')
    .update({
      upload_status: 'rejected',
      rejection_reason: publicReason,
      scanned_at: new Date().toISOString(),
      detected_mime_type: detectedMime,
    })
    .eq('id', doc.id);

  try {
    await supabase.rpc('log_audit_event', {
      p_action: 'document_rejected',
      p_resource_type: 'document',
      p_resource_id: doc.id,
      p_details: { reason, public_reason: publicReason, detected_mime_type: detectedMime },
      p_result: 'failure',
    });
  } catch (e) { console.error('audit log failed', e); }
}

async function scanWithCloudmersive(bytes: Uint8Array, apiKey: string, filename: string): Promise<{ clean: boolean; reason?: string }> {
  const form = new FormData();
  form.append('inputFile', new Blob([bytes]), filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch('https://api.cloudmersive.com/virus/scan/file/advanced', {
      method: 'POST',
      headers: {
        'Apikey': apiKey,
        'allowExecutables': 'false',
        'allowInvalidFiles': 'false',
        'allowScripts': 'false',
        'allowPasswordProtectedFiles': 'false',
        'allowMacros': 'false',
        'allowXmlExternalEntities': 'false',
        'allowInsecureDeserialization': 'false',
        'allowHtml': 'false',
      },
      body: form,
      signal: controller.signal,
    });
    if (!resp.ok) return { clean: false, reason: `scanner_http_${resp.status}` };
    const result = await resp.json();
    if (result.CleanResult === true &&
        result.ContainsExecutable !== true &&
        result.ContainsInvalidFile !== true &&
        result.ContainsScript !== true &&
        result.ContainsPasswordProtectedFile !== true &&
        result.ContainsMacros !== true &&
        result.ContainsXmlExternalEntities !== true &&
        result.ContainsInsecureDeserialization !== true &&
        result.ContainsHtml !== true) {
      return { clean: true };
    }
    return { clean: false, reason: 'scanner_flagged' };
  } catch (e: any) {
    return { clean: false, reason: e?.name === 'AbortError' ? 'scanner_timeout' : 'scanner_error' };
  } finally {
    clearTimeout(timeout);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudmersiveKey = Deno.env.get('CLOUDMERSIVE_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const rateOk = await checkUserRateLimit(supabase, user.id);
    if (!rateOk) return json({ error: 'Upload limit reached. Try again later.' }, 429);

    const { documentId }: ScanRequest = await req.json();
    if (!documentId || typeof documentId !== 'string') return json({ error: 'Invalid request' }, 400);

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, user_id, file_path, file_size, mime_type, original_filename, upload_status')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: 'Document not found' }, 404);
    if (doc.user_id !== user.id) return json({ error: 'Not authorised' }, 403);
    if (doc.upload_status === 'clean' || doc.upload_status === 'rejected') {
      return json({ ok: true, status: doc.upload_status });
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('ride-documents')
      .download(doc.file_path);

    if (dlErr || !fileBlob) {
      await rejectDocument(supabase, doc, 'download_failed', null, PUBLIC_REJECT_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_REJECT_MSG });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_BYTES) {
      await rejectDocument(supabase, doc, 'size_invalid', null, PUBLIC_REJECT_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_REJECT_MSG });
    }

    const bytes = new Uint8Array(arrayBuffer);
    const ext = fileExt(doc.original_filename || doc.file_path || '');

    if (MACRO_EXTS.has(ext)) {
      await rejectDocument(supabase, doc, 'macro_ext_blocked', null, PUBLIC_MACRO_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_MACRO_MSG });
    }

    if (!ALLOWED_EXTS.has(ext)) {
      await rejectDocument(supabase, doc, 'ext_not_allowed', null, PUBLIC_TYPE_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
    }

    const sniffed = detectMimeFromBytes(bytes);
    let effectiveMime = sniffed || doc.mime_type || null;

    // Verify magic vs extension for the cases we can sniff
    const STRICT_PAIRS: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'docx': 'application/zip',
      'xlsx': 'application/zip',
      'odt':  'application/zip',
      'ods':  'application/zip',
      'doc':  'application/x-ole-storage',
      'xls':  'application/x-ole-storage',
      'rtf':  'application/rtf',
    };
    const TEXT_EXTS = new Set(['csv']);

    if (sniffed) {
      const expected = STRICT_PAIRS[ext];
      if (expected && expected !== sniffed) {
        await rejectDocument(supabase, doc, 'magic_mismatch', sniffed, PUBLIC_TYPE_MSG);
        return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
      }
    } else if (TEXT_EXTS.has(ext)) {
      if (!isPlausibleText(bytes)) {
        await rejectDocument(supabase, doc, 'csv_not_text', null, PUBLIC_TYPE_MSG);
        return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
      }
      effectiveMime = 'text/csv';
    } else if (STRICT_PAIRS[ext]) {
      // We expected a signature but couldn't read one
      await rejectDocument(supabase, doc, 'magic_unreadable', null, PUBLIC_TYPE_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
    }

    // Normalise office mimes
    const NORMALISED_MIME: Record<string, string> = {
      'pdf':  'application/pdf',
      'png':  'image/png',
      'jpg':  'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'odt':  'application/vnd.oasis.opendocument.text',
      'ods':  'application/vnd.oasis.opendocument.spreadsheet',
      'doc':  'application/msword',
      'xls':  'application/vnd.ms-excel',
      'rtf':  'application/rtf',
      'csv':  'text/csv',
    };
    if (NORMALISED_MIME[ext]) effectiveMime = NORMALISED_MIME[ext];

    if (effectiveMime && !ALLOWED_MIMES.has(effectiveMime)) {
      await rejectDocument(supabase, doc, 'mime_not_allowed', effectiveMime, PUBLIC_TYPE_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
    }

    const checksum = await sha256Hex(arrayBuffer);

    if (!cloudmersiveKey) {
      console.error('CLOUDMERSIVE_API_KEY not configured');
      await rejectDocument(supabase, doc, 'scanner_unconfigured', effectiveMime, 'Upload could not be verified.');
      return json({ ok: false, status: 'rejected', reason: 'Upload could not be verified.' });
    }

    const scanRes = await scanWithCloudmersive(bytes, cloudmersiveKey, doc.original_filename || 'file');
    if (!scanRes.clean) {
      try {
        await supabase.rpc('log_audit_event', {
          p_action: 'document_scan_failed',
          p_resource_type: 'document',
          p_resource_id: doc.id,
          p_details: { reason: scanRes.reason, checksum, detected_mime_type: effectiveMime },
          p_result: 'failure',
        });
      } catch {}
      await rejectDocument(
        supabase, doc, scanRes.reason || 'scan_failed', effectiveMime,
        scanRes.reason === 'scanner_flagged' ? PUBLIC_REJECT_MSG : 'Upload could not be verified.',
      );
      return json({ ok: false, status: 'rejected', reason: 'Upload could not be verified.' });
    }

    // Determine preview workflow
    const needsConversion = OFFICE_PREVIEW_EXTS.has(ext);
    const previewStatus = needsConversion ? 'pending' : 'not_required';

    await supabase
      .from('documents')
      .update({
        upload_status: 'clean',
        scanned_at: new Date().toISOString(),
        detected_mime_type: effectiveMime,
        checksum,
        rejection_reason: null,
        preview_status: previewStatus,
      })
      .eq('id', doc.id);

    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'document_scan_passed',
        p_resource_type: 'document',
        p_resource_id: doc.id,
        p_details: { detected_mime_type: effectiveMime, checksum, file_size: arrayBuffer.byteLength, preview_status: previewStatus },
        p_result: 'success',
      });
    } catch {}

    // Fire-and-forget preview generation (do not block response).
    if (needsConversion) {
      try {
        // Async invocation — no need to await
        fetch(`${supabaseUrl}/functions/v1/generate-document-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ documentId: doc.id }),
        }).catch((e) => console.error('preview invoke failed', e));
      } catch (e) {
        console.error('preview invoke threw', e);
      }
    }

    return json({ ok: true, status: 'clean', preview_status: previewStatus });
  } catch (e: any) {
    console.error('validate-and-scan-document error', e);
    return json({ error: 'Upload could not be verified.' }, 500);
  }
};

serve(handler);
