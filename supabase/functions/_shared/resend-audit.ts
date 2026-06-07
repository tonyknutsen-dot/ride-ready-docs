import { logEmailSend } from "./email-logger.ts";

// Minimal type for the Resend client we use.
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

function safeMeta(extra?: Record<string, unknown>, payload?: any) {
  // Never log secrets, tokens, or full bodies. Strip obvious sensitive keys.
  const base: Record<string, unknown> = { ...(extra || {}) };
  if (payload?.attachments && Array.isArray(payload.attachments)) {
    base.attachment_count = payload.attachments.length;
    base.attachment_filenames = payload.attachments
      .map((a: any) => (typeof a?.filename === "string" ? a.filename : null))
      .filter(Boolean);
  }
  return base;
}

/**
 * Wraps resend.emails.send to log attempted/sent/failed into email_send_log.
 * Returns the same shape Resend would return so call sites need minimal changes.
 */
export async function auditedResendSend(
  resend: ResendLike,
  payload: any,
  meta: AuditMeta,
): Promise<{ data?: { id?: string } | null; error?: any }> {
  const recipient = firstRecipient(payload?.to);
  const subject = typeof payload?.subject === "string" ? payload.subject : undefined;

  // Best-effort "attempted" marker so we always have a row even if the await throws.
  // We don't fail the send if logging fails.
  await logEmailSend({
    template_name: meta.template_name,
    recipient_email: recipient,
    subject,
    status: "pending",
    user_id: meta.user_id,
    metadata: { ...safeMeta(meta.metadata, payload), function_name: meta.function_name, phase: "attempted" },
  }).catch(() => {});

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
        metadata: { ...safeMeta(meta.metadata, payload), function_name: meta.function_name, phase: "provider_error" },
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
      metadata: { ...safeMeta(meta.metadata, payload), function_name: meta.function_name, phase: "sent" },
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
      metadata: { ...safeMeta(meta.metadata, payload), function_name: meta.function_name, phase: "exception" },
    }).catch(() => {});
    throw err;
  }
}
