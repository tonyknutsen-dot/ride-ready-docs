import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Allowed types must match src/lib/uploadValidation.ts
const ALLOWED_EXTS = new Set(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'webp']);
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_BYTES = Math.floor(3.4 * 1024 * 1024); // 3.4 MB — must match src/lib/uploadValidation.ts

interface ScanRequest {
  documentId: string;
}

// Per-user rate limit using existing check_rate_limit RPC
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
    return true; // fail-open on rate-limit infra error, the scanner still gates safety
  }
}

function fileExt(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/** Magic-byte sniff for the limited allowed types. */
function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // WEBP: "RIFF" .... "WEBP"
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  // ZIP container (DOCX / XLSX): PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/zip';
  }
  return null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PUBLIC_REJECT_MSG = 'This document could not be verified and has been blocked.';
const PUBLIC_TYPE_MSG = 'This file type is not allowed.';

async function rejectDocument(
  supabase: any,
  doc: any,
  reason: string,
  detectedMime: string | null,
  publicReason: string,
) {
  // Remove the storage object so it cannot be served.
  try {
    if (doc.file_path) {
      await supabase.storage.from('ride-documents').remove([doc.file_path]);
    }
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

  // Best-effort audit log
  try {
    await supabase.rpc('log_audit_event', {
      p_action: 'document_rejected',
      p_resource_type: 'document',
      p_resource_id: doc.id,
      p_details: { reason, public_reason: publicReason, detected_mime_type: detectedMime },
      p_result: 'failure',
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
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
    if (!resp.ok) {
      return { clean: false, reason: `scanner_http_${resp.status}` };
    }
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
    if (!rateOk) {
      return json({ error: 'Upload limit reached. Try again later.' }, 429);
    }

    const { documentId }: ScanRequest = await req.json();
    if (!documentId || typeof documentId !== 'string') {
      return json({ error: 'Invalid request' }, 400);
    }

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, user_id, file_path, file_size, mime_type, original_filename, upload_status')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: 'Document not found' }, 404);
    if (doc.user_id !== user.id) {
      // Allow staff who have access via app logic — but for the scan path we
      // require the uploader themselves. Stricter is safer here.
      return json({ error: 'Not authorised' }, 403);
    }
    if (doc.upload_status === 'clean' || doc.upload_status === 'rejected') {
      return json({ ok: true, status: doc.upload_status });
    }

    // Download from private storage and re-validate server-side.
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
    if (!ALLOWED_EXTS.has(ext)) {
      await rejectDocument(supabase, doc, 'ext_not_allowed', null, PUBLIC_TYPE_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
    }

    const sniffed = detectMimeFromBytes(bytes);
    let effectiveMime = sniffed || doc.mime_type || null;

    // Match magic-bytes to extension where we can sniff
    if (sniffed) {
      const okPairs: Record<string, string> = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'docx': 'application/zip',
        'xlsx': 'application/zip',
      };
      if (okPairs[ext] !== sniffed) {
        await rejectDocument(supabase, doc, 'magic_mismatch', sniffed, PUBLIC_TYPE_MSG);
        return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
      }
      // Normalise office to their real mime
      if (ext === 'docx') effectiveMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (ext === 'xlsx') effectiveMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      // No magic match for an extension we DO sniff — reject
      if (['pdf','png','jpg','jpeg','webp','docx','xlsx'].includes(ext)) {
        await rejectDocument(supabase, doc, 'magic_unreadable', null, PUBLIC_TYPE_MSG);
        return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
      }
    }

    if (effectiveMime && !ALLOWED_MIMES.has(effectiveMime)) {
      await rejectDocument(supabase, doc, 'mime_not_allowed', effectiveMime, PUBLIC_TYPE_MSG);
      return json({ ok: false, status: 'rejected', reason: PUBLIC_TYPE_MSG });
    }

    const checksum = await sha256Hex(arrayBuffer);

    // Malware scan
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
      await rejectDocument(supabase, doc,
        scanRes.reason || 'scan_failed',
        effectiveMime,
        scanRes.reason === 'scanner_flagged' ? PUBLIC_REJECT_MSG : 'Upload could not be verified.',
      );
      return json({ ok: false, status: 'rejected', reason: 'Upload could not be verified.' });
    }

    // Approve
    await supabase
      .from('documents')
      .update({
        upload_status: 'clean',
        scanned_at: new Date().toISOString(),
        detected_mime_type: effectiveMime,
        checksum,
        rejection_reason: null,
      })
      .eq('id', doc.id);

    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'document_scan_passed',
        p_resource_type: 'document',
        p_resource_id: doc.id,
        p_details: { detected_mime_type: effectiveMime, checksum, file_size: arrayBuffer.byteLength },
        p_result: 'success',
      });
    } catch {}

    return json({ ok: true, status: 'clean' });
  } catch (e: any) {
    console.error('validate-and-scan-document error', e);
    return json({ error: 'Upload could not be verified.' }, 500);
  }
};

serve(handler);
