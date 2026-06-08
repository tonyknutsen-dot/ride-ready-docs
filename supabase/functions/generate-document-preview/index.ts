import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// This function is invoked either server-to-server with the service-role key
// by validate-and-scan-document AFTER the original file has passed malware
// scanning (upload_status = 'clean'), OR by an authenticated owner from the
// UI ("Retry preview"). It converts Office documents to PDF via the
// Cloudmersive Convert API and stores the result in the private
// 'document-previews' bucket.
//
// Originals are NEVER modified. If conversion fails or isn't supported,
// the document remains usable for download — only the preview is marked
// failed/not_supported.

interface Body { documentId: string }

const OFFICE_PREVIEW_EXTS = new Set(['docx', 'doc', 'rtf', 'odt', 'xlsx', 'xls', 'csv', 'ods']);
const CONVERT_TIMEOUT_MS = 60_000;

function fileExt(name: string): string {
  const parts = (name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Map an extension to the most specific Cloudmersive Convert endpoint.
 * We prefer the autodetect endpoint for legacy / less-common formats.
 */
function cloudmersiveEndpointFor(ext: string): string | null {
  switch (ext) {
    case 'docx': return 'https://api.cloudmersive.com/convert/docx/to/pdf';
    case 'xlsx': return 'https://api.cloudmersive.com/convert/xlsx/to/pdf';
    case 'doc':
    case 'xls':
    case 'rtf':
    case 'odt':
    case 'ods':
    case 'csv':
      return 'https://api.cloudmersive.com/convert/autodetect/to/pdf';
    default:
      return null;
  }
}

async function convertToPdf(bytes: Uint8Array, ext: string, apiKey: string, filename: string): Promise<
  { ok: true; pdf: Uint8Array; contentType: string | null; byteLength: number; startsWithPdf: boolean }
  | { ok: false; status: 'failed' | 'not_supported'; reason: string; cloudmersiveStatus?: number; contentType?: string | null; byteLength?: number; startsWithPdf?: boolean }
> {
  const endpoint = cloudmersiveEndpointFor(ext);
  if (!endpoint) return { ok: false, status: 'not_supported', reason: 'extension_not_supported' };

  const form = new FormData();
  form.append('inputFile', new Blob([bytes]), filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONVERT_TIMEOUT_MS);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Apikey': apiKey },
      body: form,
      signal: controller.signal,
    });
    const contentType = resp.headers.get('content-type');
    const headerLog = {
      contentType,
      contentLength: resp.headers.get('content-length'),
      contentDisposition: resp.headers.get('content-disposition'),
    };
    console.log('Cloudmersive convert response', { ext, filename, status: resp.status, headers: headerLog });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('Cloudmersive convert failed', { ext, status: resp.status, message: text.slice(0, 200) });
      // Cloudmersive returns 401 / "Subscription not active" if the Convert API
      // is not enabled on the key. Treat as not_supported (no retry storm).
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, status: 'not_supported', reason: `convert_unauthorised_${resp.status}`, cloudmersiveStatus: resp.status, contentType };
      }
      return { ok: false, status: 'failed', reason: `convert_http_${resp.status}`, cloudmersiveStatus: resp.status, contentType };
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    const startsWithPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    console.log('Cloudmersive convert bytes', { ext, status: resp.status, contentType, byteLength: buf.byteLength, startsWithPdf });
    if (buf.byteLength <= 0) {
      return { ok: false, status: 'failed', reason: 'convert_empty_response', cloudmersiveStatus: resp.status, contentType, byteLength: buf.byteLength, startsWithPdf };
    }
    // Cloudmersive can return application/octet-stream for a valid PDF; trust the bytes, not only the header.
    if (!startsWithPdf) {
      return { ok: false, status: 'failed', reason: 'convert_not_pdf', cloudmersiveStatus: resp.status, contentType, byteLength: buf.byteLength, startsWithPdf };
    }
    return { ok: true, pdf: buf, contentType, byteLength: buf.byteLength, startsWithPdf };
  } catch (e: any) {
    return {
      ok: false,
      status: 'failed',
      reason: e?.name === 'AbortError' ? 'convert_timeout' : `convert_error:${e?.message || 'unknown'}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req: Request): Promise<Response> => {
  const corsPreflight = handleCorsPreflightRequest(req);
  if (corsPreflight) return corsPreflight;
  const cors = getCorsHeaders(req.headers.get('origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const cloudmersiveKey = Deno.env.get('CLOUDMERSIVE_API_KEY');

    // Accept either (a) a server-to-server call presenting the service key,
    // or (b) a logged-in user who owns the document (used by the UI "Retry
    // preview" action). Anonymous callers are rejected.
    const auth = req.headers.get('Authorization') || '';
    const bearer = auth.replace(/^Bearer\s+/i, '');
    const isServiceCall = bearer === serviceKey;

    const { documentId } = (await req.json()) as Body;
    if (!documentId || typeof documentId !== 'string') {
      return json({ error: 'invalid_request' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (!isServiceCall) {
      // Validate the caller's JWT and ownership of the document.
      if (!bearer) {
        return json({ error: 'unauthorised' }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes?.user) {
        return json({ error: 'unauthorised' }, 401);
      }
      const { data: ownDoc } = await supabase
        .from('documents')
        .select('id, user_id')
        .eq('id', documentId)
        .maybeSingle();
      if (!ownDoc || ownDoc.user_id !== userRes.user.id) {
        return json({ error: 'forbidden' }, 403);
      }
    }

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, user_id, file_path, original_filename, upload_status, preview_status')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return json({ error: 'not_found' }, 404);
    }
    // Allow generation for:
    //  - uploaded files that passed scanning (upload_status='clean'), and
    //  - generated / legacy documents that never went through the scanner
    //    (upload_status IS NULL — these are produced by the app itself).
    // Block only quarantined / rejected / in-flight uploads.
    if (doc.upload_status && doc.upload_status !== 'clean') {
      return json({ error: 'not_clean' }, 409);
    }
    if (doc.preview_status === 'ready') {
      return json({ ok: true, status: 'ready' });
    }

    const ext = fileExt(doc.original_filename || doc.file_path || '');
    if (!OFFICE_PREVIEW_EXTS.has(ext)) {
      await supabase
        .from('documents')
        .update({ preview_status: 'not_required', preview_failure_reason: null })
        .eq('id', doc.id);
      return json({ ok: true, status: 'not_required' });
    }

    if (!cloudmersiveKey) {
      await supabase
        .from('documents')
        .update({ preview_status: 'failed', preview_failure_reason: 'no_api_key' })
        .eq('id', doc.id);
      return json({ error: 'missing_key' }, 500);
    }

    // Mark as pending so the UI shows "Preparing preview…" during conversion.
    await supabase
      .from('documents')
      .update({ preview_status: 'pending', preview_failure_reason: null })
      .eq('id', doc.id);

    const { data: blob, error: dlErr } = await supabase.storage
      .from('ride-documents')
      .download(doc.file_path);

    if (dlErr || !blob) {
      await supabase
        .from('documents')
        .update({ preview_status: 'failed', preview_failure_reason: 'download_failed' })
        .eq('id', doc.id);
      return json({ error: 'download_failed' }, 500);
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await convertToPdf(bytes, ext, cloudmersiveKey, doc.original_filename || `file.${ext}`);

    if (!result.ok) {
      await supabase
        .from('documents')
        .update({
          preview_status: result.status,
          preview_failure_reason: result.reason,
          preview_generated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      try {
        await supabase.rpc('log_audit_event', {
          p_action: 'document_preview_failed',
          p_resource_type: 'document',
          p_resource_id: doc.id,
          p_details: { ext, reason: result.reason, status: result.status },
          p_result: 'failure',
        });
      } catch {}

      return json({ ok: false, status: result.status });
    }

    const previewPath = `${doc.user_id}/previews/${doc.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('document-previews')
      .upload(previewPath, result.pdf, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      await supabase
        .from('documents')
        .update({
          preview_status: 'failed',
          preview_failure_reason: `upload_failed:${upErr.message}`,
          preview_generated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);
      return json({ error: 'preview_upload_failed' }, 500);
    }

    await supabase
      .from('documents')
      .update({
        preview_status: 'ready',
        preview_file_path: previewPath,
        preview_mime_type: 'application/pdf',
        preview_generated_at: new Date().toISOString(),
        preview_failure_reason: null,
      })
      .eq('id', doc.id);

    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'document_preview_generated',
        p_resource_type: 'document',
        p_resource_id: doc.id,
        p_details: { ext, preview_size: result.pdf.byteLength },
        p_result: 'success',
      });
    } catch {}

    return json({ ok: true, status: 'ready' });
  } catch (e: any) {
    console.error('generate-document-preview error', e);
    return json({ error: 'internal' }, 500);
  }
});
