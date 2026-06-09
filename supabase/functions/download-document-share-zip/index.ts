import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  getClientIp,
  checkIpBlocked,
  createBlockedIpResponse,
} from "../_shared/rate-limit.ts";

const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100MB

function sanitizeFilename(name: string): string {
  // Remove path separators and unsafe characters
  const cleaned = (name || "document")
    .replace(/[\/\\]/g, "_")
    .replace(/[\x00-\x1f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : "document";
}

function sanitizeZipName(name: string): string {
  const cleaned = (name || "Documents")
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "Documents";
}

function ensureUniqueName(taken: Set<string>, name: string): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dotIdx = name.lastIndexOf(".");
  const base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const ext = dotIdx > 0 ? name.slice(dotIdx) : "";
  let i = 1;
  while (taken.has(`${base} (${i})${ext}`)) i++;
  const next = `${base} (${i})${ext}`;
  taken.add(next);
  return next;
}

const handler = async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rateLimitKey = getClientIdentifier(req, "download-document-share-zip");
    const rateLimitResult = await checkRateLimit(rateLimitKey, "public");
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    let shareToken: string | undefined;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      shareToken = body?.shareToken;
    } else {
      const url = new URL(req.url);
      shareToken = url.searchParams.get("token") || undefined;
    }

    if (!shareToken || typeof shareToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Share token is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const tokenPreview = shareToken.substring(0, 8);

    const { data: share, error: shareErr } = await supabase
      .from("document_shares")
      .select("*")
      .eq("share_token", shareToken)
      .single();

    if (shareErr || !share) {
      console.log(`[zip] token=${tokenPreview} share_not_found`);
      return new Response(
        JSON.stringify({ error: "Invalid or expired share link" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (share.is_revoked) {
      return new Response(
        JSON.stringify({ error: "This share link has been revoked" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: shareItems, error: itemsErr } = await supabase
      .from("document_share_items")
      .select("id, document_id, file_path, document_name, ride_name")
      .eq("share_id", share.id);

    if (itemsErr || !shareItems || shareItems.length === 0) {
      console.error(`[zip] token=${tokenPreview} items_error`, itemsErr);
      return new Response(
        JSON.stringify({ error: "No documents available in this share." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Filter out documents that are no longer allowed (rejected/pending_scan).
    const docIds = shareItems.map((s) => s.document_id).filter(Boolean);
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, upload_status, file_size")
      .in("id", docIds);
    const allowedIds = new Set(
      (docRows || [])
        .filter((d: any) => d.upload_status === null || !["pending_scan", "rejected"].includes(d.upload_status))
        .map((d: any) => d.id),
    );
    const sizeMap = new Map<string, number>((docRows || []).map((d: any) => [d.id, d.file_size || 0]));

    const eligible = shareItems.filter((s) => s.document_id && allowedIds.has(s.document_id));
    const totalDeclared = eligible.reduce((sum, s) => sum + (sizeMap.get(s.document_id) || 0), 0);

    console.log(`[zip] token=${tokenPreview} requested=${shareItems.length} eligible=${eligible.length} declared_size=${totalDeclared}`);

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ error: "No downloadable documents are available in this share." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (eligible.length > MAX_FILES || totalDeclared > MAX_TOTAL_BYTES) {
      console.log(`[zip] token=${tokenPreview} too_large files=${eligible.length} bytes=${totalDeclared}`);
      return new Response(
        JSON.stringify({
          error: "This package is too large for one ZIP download. Please download the documents individually.",
          tooLarge: true,
        }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Build ZIP
    const zip = new JSZip();
    const taken = new Set<string>();
    let totalActual = 0;
    let added = 0;

    for (const item of eligible) {
      try {
        const { data: fileBlob, error: dlErr } = await supabase.storage
          .from("ride-documents")
          .download(item.file_path);
        if (dlErr || !fileBlob) {
          console.warn(`[zip] token=${tokenPreview} skip_missing item=${item.id}`);
          continue;
        }
        const buf = await fileBlob.arrayBuffer();
        totalActual += buf.byteLength;
        if (totalActual > MAX_TOTAL_BYTES) {
          console.log(`[zip] token=${tokenPreview} exceeded_during_build`);
          return new Response(
            JSON.stringify({
              error: "This package is too large for one ZIP download. Please download the documents individually.",
              tooLarge: true,
            }),
            { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        // Preserve extension from stored file_path if document_name lacks one
        let displayName = sanitizeFilename(item.document_name);
        const storedExt = item.file_path.includes(".") ? item.file_path.split(".").pop() : "";
        if (storedExt && !/\.[a-z0-9]{1,8}$/i.test(displayName)) {
          displayName = `${displayName}.${storedExt}`;
        }

        // Folder by ride name when present
        const rideFolder = item.ride_name && item.ride_name !== "Global"
          ? `${sanitizeFilename(item.ride_name)}/`
          : "";
        const finalName = ensureUniqueName(taken, `${rideFolder}${displayName}`);
        zip.file(finalName, buf);
        added++;
      } catch (e: any) {
        console.warn(`[zip] token=${tokenPreview} item_error item=${item.id} msg=${e?.message}`);
      }
    }

    if (added === 0) {
      console.error(`[zip] token=${tokenPreview} no_files_added`);
      return new Response(
        JSON.stringify({ error: "We could not prepare the ZIP download. You can still download the documents individually." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Get sender info for filename
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, controller_name")
      .eq("user_id", share.user_id)
      .single();

    const senderLabel = profile?.company_name || profile?.controller_name || "Documents";
    const zipFilename = `RideReadyDocs-${sanitizeZipName(senderLabel)}-Documents.zip`;

    console.log(`[zip] token=${tokenPreview} success files=${added} bytes=${zipBytes.byteLength} filename=${zipFilename}`);

    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[zip] unhandled_error", error?.message || error);
    return new Response(
      JSON.stringify({ error: "We could not prepare the ZIP download. You can still download the documents individually." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
