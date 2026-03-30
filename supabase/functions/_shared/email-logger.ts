import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface EmailLogEntry {
  template_name: string;
  recipient_email: string;
  subject?: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  message_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

export async function logEmailSend(entry: EmailLogEntry): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.warn("[email-logger] Missing SUPABASE_URL or SERVICE_ROLE_KEY, skipping log");
      return;
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from("email_send_log").insert({
      template_name: entry.template_name,
      recipient_email: entry.recipient_email,
      subject: entry.subject || null,
      status: entry.status,
      error_message: entry.error_message || null,
      message_id: entry.message_id || null,
      user_id: entry.user_id || null,
      metadata: entry.metadata || {},
    });

    if (error) {
      console.error("[email-logger] Failed to log email:", error.message);
    }
  } catch (err) {
    console.error("[email-logger] Unexpected error:", err);
  }
}
