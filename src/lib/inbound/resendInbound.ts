import { Resend } from "resend";
import { LEAD_QUEUE_STATUS } from "@/lib/admin/leadsRepository";
import { createSupabaseServer } from "@/lib/supabase-server";

export type ResendInboundPayload = {
  type?: string;
  from?: string;
  text?: string;
  textBody?: string;
  subject?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    textBody?: string;
  };
};

export type ResendInboundResult = {
  received: true;
  matched: boolean;
  leadId?: string;
  from?: string;
  subject?: string;
};

function resolveResendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || process.env.VITE_RESEND_API_KEY?.trim() || null;
}

export function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  return (bracketMatch?.[1] ?? trimmed).trim().toLowerCase();
}

export function parseResendInboundPayload(raw: unknown): ResendInboundPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON payload.");
  }
  return raw as ResendInboundPayload;
}

export function resolveFromAddress(payload: ResendInboundPayload): string | null {
  const from = payload.from ?? payload.data?.from;
  if (!from?.trim()) return null;
  return extractEmailAddress(from);
}

export function resolveSubject(payload: ResendInboundPayload): string {
  return (payload.subject ?? payload.data?.subject ?? "").trim();
}

function resolveInlineReplyText(payload: ResendInboundPayload): string {
  const candidates = [
    payload.text,
    payload.textBody,
    payload.data?.text,
    payload.data?.textBody,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

async function fetchReplyTextFromResend(emailId: string, apiKey: string): Promise<string> {
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.receiving.get(emailId);

  if (error || !data) {
    console.warn("[api/inbound/resend] Resend receiving API failed:", error?.message ?? "No data");
    return "";
  }

  if (typeof data.text === "string" && data.text.trim()) {
    return data.text.trim();
  }

  if (typeof data.html === "string" && data.html.trim()) {
    return data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

export async function resolveReplyText(payload: ResendInboundPayload): Promise<string> {
  const inline = resolveInlineReplyText(payload);
  if (inline) return inline;

  const emailId = payload.data?.email_id?.trim();
  const apiKey = resolveResendApiKey();
  if (!emailId || !apiKey) return "";

  return fetchReplyTextFromResend(emailId, apiKey);
}

const REPLY_SNIPPET_MAX_LENGTH = 200;

function truncateReplySnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty body)";
  if (normalized.length <= REPLY_SNIPPET_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, REPLY_SNIPPET_MAX_LENGTH - 1)}…`;
}

function buildSlackHotLeadMessage(input: {
  prospectEmail: string;
  subject: string;
  replyText: string;
}): string {
  const snippet = truncateReplySnippet(input.replyText);
  const subjectLine = input.subject.trim() || "—";

  return [
    "🚨 *HOT LEAD ALERT* 🚨",
    "",
    `*Prospect:* ${input.prospectEmail}`,
    `*Subject:* ${subjectLine}`,
    "",
    `> ${snippet}`,
  ].join("\n");
}

async function notifySlackHotLead(input: {
  prospectEmail: string;
  subject: string;
  replyText: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("[api/inbound/resend] SLACK_WEBHOOK_URL not set; skipping Slack notification");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: buildSlackHotLeadMessage(input),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "[api/inbound/resend] Slack notification failed:",
        response.status,
        body,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/inbound/resend] Slack notification error:", message);
  }
}

export async function handleResendInbound(
  payload: ResendInboundPayload,
): Promise<ResendInboundResult> {
  if (payload.type && payload.type !== "email.received") {
    return { received: true, matched: false };
  }

  const fromEmail = resolveFromAddress(payload);
  const subject = resolveSubject(payload);

  if (!fromEmail) {
    console.warn("[api/inbound/resend] Missing from address in webhook payload");
    return { received: true, matched: false };
  }

  const supabase = createSupabaseServer();
  const now = new Date().toISOString();

  const { data: lead, error: lookupError } = await supabase
    .from("leads")
    .select("id, email, client_id, prospect_name")
    .ilike("email", fromEmail)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[api/inbound/resend] Lead lookup failed:", lookupError.message);
    return { received: true, matched: false, from: fromEmail, subject };
  }

  if (!lead?.id) {
    console.warn("[api/inbound/resend] No matching lead for inbound email:", fromEmail);
    return { received: true, matched: false, from: fromEmail, subject };
  }

  const replyText = await resolveReplyText(payload);

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: "replied",
      queue_status: LEAD_QUEUE_STATUS.PAUSED,
      is_hot_lead: true,
      last_activity: now,
    })
    .eq("id", lead.id);

  if (updateError) {
    console.error("[api/inbound/resend] Lead update failed:", updateError.message);
    return { received: true, matched: false, from: fromEmail, subject };
  }

  if (replyText) {
    const { error: replyError } = await supabase.from("replies").insert({
      lead_id: lead.id,
      text: replyText,
    });

    if (replyError) {
      console.error("[api/inbound/resend] Reply insert failed:", replyError.message);
    }
  }

  await notifySlackHotLead({
    prospectEmail: lead.email ?? fromEmail,
    subject,
    replyText,
  });

  console.info("[api/inbound/resend] Halted sequence for lead", {
    leadId: lead.id,
    from: fromEmail,
    subject,
  });

  return {
    received: true,
    matched: true,
    leadId: lead.id,
    from: fromEmail,
    subject,
  };
}
