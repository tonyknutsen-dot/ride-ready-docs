import { logEmailSend } from "./email-logger.ts";

interface ResendLike {
  emails: {
    send: (payload: any) => Promise<{ data?: { id?: string } | null; error?: any }>;
  };
}

export interface AuditMeta {
  function_name: string;
  template_name: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

function firstRecipient(to: unknown): string {
  if (Array.isArray(to)) return String(to[0] ?? "unknown");
  if (typeof to === "string") return to;
  return "unknown";
}

function safeMeta(extra: Record<string, unknown> | undefined, payload: any, functionName: string) {
  const base: Record<string, unknown> = { function_name: functionName, ...(extra || {}) };
  if (payload?.attachments && Array.isArray(payload.attachments)) {
    base.attachment_count = payload.attachments.length;
    base.attachment_filenames = payload.attachments
      .map((a: any) => (typeof a?.filename === "string" ? a.filename : null))
      .filter(Boolean);
  }
  return base;
}

/**
 * Wraps resend.emails.send and logs sent/failed into email_send_log.
 * No "pending" rows are written so dedup by message_id stays clean.
 * Logging failures never block the email response.
 */
export async function auditedResendSend(
  resend: ResendLike,
  payload: any,
  meta: AuditMeta,
): Promise<{ data?: { id?: string } | null; error?: any }> {
  const recipient = firstRecipient(payload?.to);
  const subject = typeof payload?.subject === "string" ? payload.subject : undefined;
  const metaSafe = safeMeta(meta.metadata, payload, meta.function_name);

  try {
    const result = await resend.emails.send(payload);

    if (result?.error) {
      await logEmailSend({
        template_name: meta.template_name,
        recipient_email: recipient,
        subject,
        status: "failed",
        error_message: typeof result.error === "string" ? result.error : JSON.stringify(result.error),
        user_id: meta.user_id,
        metadata: { ...metaSafe, phase: "provider_error" },
      }).catch(() => {});
      return result;
    }

    await logEmailSend({
      template_name: meta.template_name,
      recipient_email: recipient,
      subject,
      status: "sent",
      message_id: result?.data?.id || undefined,
      user_id: meta.user_id,
      metadata: metaSafe,
    }).catch(() => {});

    return result;
  } catch (err: any) {
    await logEmailSend({
      template_name: meta.template_name,
      recipient_email: recipient,
      subject,
      status: "failed",
      error_message: err?.message || String(err),
      user_id: meta.user_id,
      metadata: { ...metaSafe, phase: "exception" },
    }).catch(() => {});
    throw err;
  }
}
