import { Resend } from "resend";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  leadRowToMergeFields,
  personalizeOutboundEmailContent,
} from "@/lib/outbound/leadMergeVariables";
import { appendOutboundFounderSignature } from "@/lib/outbound/outboundSignature";

export type OutboundSendRequest = {
  lead_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  client_id?: string;
};

export type OutboundSendResult =
  | { ok: true; resendId: string; leadId: string }
  | { ok: false; status: number; error: string };

function resolveFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.VITE_RESEND_FROM_EMAIL?.trim() ||
    "Halton Works <onboarding@resend.dev>"
  );
}

function resolveResendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || process.env.VITE_RESEND_API_KEY?.trim() || null;
}

export async function sendOutboundEmail(
  input: OutboundSendRequest,
): Promise<OutboundSendResult> {
  const leadId = input.lead_id?.trim();
  const recipientEmail = input.recipient_email?.trim();
  const subject = input.subject?.trim();
  const body = input.body?.trim();
  const clientId = input.client_id?.trim();

  if (!leadId || !recipientEmail || !subject || !body) {
    return {
      ok: false,
      status: 400,
      error: "Missing lead_id, recipient_email, subject, or body.",
    };
  }

  const resendApiKey = resolveResendApiKey();
  if (!resendApiKey) {
    return { ok: false, status: 500, error: "RESEND_API_KEY is not configured." };
  }

  const supabase = createSupabaseServer();
  const now = new Date().toISOString();

  const { data: lead, error: leadLookupError } = await supabase
    .from("leads")
    .select("id, client_id, email, prospect_name, target_company, target_role, form_data")
    .eq("id", leadId)
    .maybeSingle();

  if (leadLookupError) {
    console.error("[api/outbound/send] Lead lookup failed:", leadLookupError);
    return { ok: false, status: 500, error: "Failed to load lead." };
  }

  if (!lead?.id) {
    return { ok: false, status: 404, error: "Lead not found." };
  }

  if (clientId && lead.client_id && lead.client_id !== clientId) {
    return { ok: false, status: 403, error: "Lead does not belong to this client." };
  }

  const mergeFields = leadRowToMergeFields(lead as Record<string, unknown>);
  const { subject: personalizedSubject, body: personalizedBodyRaw } =
    personalizeOutboundEmailContent(subject, body, mergeFields);
  const personalizedBody = appendOutboundFounderSignature(personalizedBodyRaw);

  const resend = new Resend(resendApiKey);

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: resolveFromEmail(),
    to: recipientEmail,
    subject: personalizedSubject,
    text: personalizedBody,
  });

  if (sendError || !sendData?.id) {
    const message = sendError?.message ?? "Resend did not return a message id.";
    console.error("[api/outbound/send] Resend failed:", sendError);

    const { error: failureUpdateError } = await supabase
      .from("leads")
      .update({
        status: "send_failed",
        last_activity: now,
      })
      .eq("id", leadId);

    if (failureUpdateError) {
      console.error("[api/outbound/send] Failed to record send failure:", failureUpdateError);
    }

    return { ok: false, status: 500, error: message };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: "contacted",
      last_activity: now,
      sent_at: now,
      queue_status: "sent",
      campaign_status: "SENT",
      generated_copy: personalizedBody,
    })
    .eq("id", leadId);

  if (updateError) {
    console.error("[api/outbound/send] Lead update after send failed:", updateError);
    return {
      ok: false,
      status: 500,
      error: `Email sent (Resend id: ${sendData.id}) but lead update failed: ${updateError.message}`,
    };
  }

  return { ok: true, resendId: sendData.id, leadId };
}
