import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertLeadsChannel } from "../_shared/alerting.ts";
import { resolveInboundReplyToAddress } from "../_shared/inboundReplyTo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { classifyReplyIntent } from "../_shared/replyIntent.ts";
import {
  buildNotionReplyPageChildren,
  buildNotionReplyParagraphBlock,
  splitInboundEmailReply,
} from "../_shared/emailReplyParse.ts";

/** Must match Notion column names exactly — including spaces/casing. */
const NOTION_COLUMNS = {
  EMAIL: "Email",
  STATUS: "Status",
  COMPANY: "Company",
  LEAD_NAME: "Lead Name",
} as const;

/** Production: full DB lookup, sequence kill switch, Slack alerts. */
const TEMPORARY_BYPASS = false;
const REPLY_SNIPPET_MAX_LENGTH = 200;

type LeadMatch = {
  id: string;
  client_id: string | null;
  email: string | null;
  prospect_name: string | null;
};

type ResendInboundPayload = {
  type?: string;
  from?: string;
  text?: string;
  data?: {
    email_id?: string;
    from?: string;
    text?: string;
    subject?: string;
  };
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  const email = (bracketMatch?.[1] ?? trimmed).trim().toLowerCase();
  return email;
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function buildProspectLabel(lead: LeadMatch, fromEmail: string): string {
  const name = lead.prospect_name?.trim();
  const email = lead.email?.trim() || fromEmail;
  if (name && email) return `${name} (${email})`;
  return name || email;
}

function buildOutboundQueueUrl(clientId: string | null): string | null {
  if (!clientId) return null;

  const appBaseUrl = Deno.env.get("APP_BASE_URL")?.trim().replace(/\/$/, "");
  if (!appBaseUrl) {
    console.warn("[inbound-webhook] APP_BASE_URL not set; Slack link omitted");
    return null;
  }

  return `${appBaseUrl}/admin/client/${clientId}/outbound`;
}

function buildHotLeadSlackMessage(input: {
  prospectLabel: string;
  replySnippet: string;
  outboundUrl: string | null;
}): string {
  let message = `*Prospect:* ${input.prospectLabel}\n*Reply:* ${input.replySnippet}`;

  if (input.outboundUrl) {
    message += `\n<${input.outboundUrl}|Open Outbound Queue>`;
  }

  return message;
}

async function notifySlackHotLead(input: {
  clientWebhook: string | null | undefined;
  prospectLabel: string;
  replySnippet: string;
  outboundUrl: string | null;
}): Promise<{ ok: boolean; source: string }> {
  const message = buildHotLeadSlackMessage({
    prospectLabel: input.prospectLabel,
    replySnippet: input.replySnippet,
    outboundUrl: input.outboundUrl,
  });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "Hot Lead Reply", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: message },
    },
  ];

  if (input.clientWebhook?.trim()) {
    const slackResponse = await fetch(input.clientWebhook.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, text: "Hot Lead Reply" }),
    });

    if (slackResponse.ok) {
      return { ok: true, source: "client_webhook" };
    }

    const slackBody = await slackResponse.text();
    console.error("[inbound-webhook] client Slack webhook failed:", slackResponse.status, slackBody);
  }

  const platform = await alertLeadsChannel(message);
  if (platform.ok) {
    return { ok: true, source: "platform_env" };
  }

  console.warn("[inbound-webhook] Slack leads alert skipped:", platform.error);
  return { ok: false, source: "none" };
}

async function logNotionSchemaForDebug(
  databaseId: string,
  apiKey: string,
  attemptedPropertyKeys: string[],
): Promise<void> {
  console.error("NOTION_ATTEMPTED_PROPERTIES:", JSON.stringify(attemptedPropertyKeys));

  try {
    const schemaResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
      },
    });
    const schema = await schemaResponse.json();

    if (!schemaResponse.ok) {
      console.error("NOTION_SCHEMA_FETCH_FAILED:", JSON.stringify(schema));
      return;
    }

    const columns = Object.entries(
      (schema as { properties?: Record<string, { type?: string }> }).properties ?? {},
    ).map(([name, prop]) => `${JSON.stringify(name)} (${prop.type ?? "unknown"})`);

    console.error("NOTION_DATABASE_COLUMNS:", JSON.stringify(columns));
  } catch (error) {
    console.error(
      "NOTION_SCHEMA_FETCH_ERROR:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function appendNotionBlockChildren(
  blockId: string,
  children: Record<string, unknown>[],
  apiKey: string,
): Promise<boolean> {
  if (!children.length) return true;

  const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ children }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[inbound-webhook] Notion append block children failed:", response.status, body);
    return false;
  }

  return true;
}

async function findNotionThreadHistoryToggleBlockId(
  pageId: string,
  apiKey: string,
): Promise<string | null> {
  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[inbound-webhook] Notion list page blocks failed:", response.status, body);
    return null;
  }

  const payload = (await response.json()) as {
    results?: Array<{ id?: string; type?: string; toggle?: { rich_text?: Array<{ plain_text?: string }> } }>;
  };

  for (const block of payload.results ?? []) {
    if (block.type !== "toggle") continue;
    const heading = block.toggle?.rich_text?.[0]?.plain_text?.trim();
    if (heading === "View Full Email Thread History" && block.id) {
      return block.id;
    }
  }

  return null;
}

async function createNotionHotLeadEntry(input: {
  prospectEmail: string;
  replyText: string;
}): Promise<string | null> {
  const notionApiKey = Deno.env.get("NOTION_API_KEY")?.trim();
  const notionDatabaseId = Deno.env.get("NOTION_DATABASE_ID")?.trim();

  if (!notionApiKey || !notionDatabaseId) {
    console.warn(
      "[inbound-webhook] NOTION_API_KEY or NOTION_DATABASE_ID not set; skipping Notion CRM entry",
    );
    return null;
  }

  const fromEmail = input.prospectEmail;
  const { freshReply, threadHistory } = splitInboundEmailReply(input.replyText);
  const pageChildren = buildNotionReplyPageChildren(freshReply, threadHistory);

  const notionData: Record<string, unknown> = {
    parent: { database_id: notionDatabaseId },
    properties: {
      [NOTION_COLUMNS.EMAIL]: {
        email: fromEmail,
      },
      [NOTION_COLUMNS.STATUS]: {
        status: { name: "Replied" },
      },
      [NOTION_COLUMNS.COMPANY]: {
        rich_text: [{ text: { content: freshReply.substring(0, 2000) } }],
      },
      [NOTION_COLUMNS.LEAD_NAME]: {
        title: [{ text: { content: fromEmail } }],
      },
    },
  };

  if (pageChildren.length) {
    notionData.children = pageChildren;
  }

  const notionResponse = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(notionData),
  });

  const notionResult = await notionResponse.json();

  if (!notionResponse.ok) {
    console.error("NOTION_ERROR:", JSON.stringify(notionResult));
    await logNotionSchemaForDebug(
      notionDatabaseId,
      notionApiKey,
      Object.keys(notionData.properties as Record<string, unknown>),
    );
    return null;
  }

  const pageId =
    typeof notionResult === "object" && notionResult !== null && "id" in notionResult
      ? String((notionResult as { id: string }).id)
      : null;

  if (pageId && threadHistory.trim()) {
    const toggleBlockId = await findNotionThreadHistoryToggleBlockId(pageId, notionApiKey);
    if (toggleBlockId) {
      await appendNotionBlockChildren(
        toggleBlockId,
        [buildNotionReplyParagraphBlock(threadHistory)],
        notionApiKey,
      );
    }
  }

  const pageUrl =
    typeof notionResult === "object" && notionResult !== null && "url" in notionResult
      ? String((notionResult as { url: string }).url)
      : null;

  return pageUrl;
}

async function parseRequestJson(req: Request): Promise<ResendInboundPayload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    throw new Error("Could not read request body");
  }

  if (!rawBody.trim()) {
    throw new Error("Request body is empty");
  }

  try {
    return JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function resolveFromAddress(payload: ResendInboundPayload): string {
  const from = payload.from ?? payload.data?.from;
  if (!from?.trim()) {
    throw new Error("Missing from address in webhook payload");
  }
  return extractEmailAddress(from);
}

async function resolveReplyText(
  payload: ResendInboundPayload,
  resendApiKey: string | null,
): Promise<string> {
  const inlineText = payload.text ?? payload.data?.text;
  if (typeof inlineText === "string" && inlineText.trim()) {
    return inlineText.trim();
  }

  const emailId = payload.data?.email_id;
  if (!emailId?.trim() || !resendApiKey?.trim()) {
    return "";
  }

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn("[inbound-webhook] Resend receiving API failed:", response.status, errorText);
    return "";
  }

  const email = (await response.json()) as { text?: string; html?: string };
  if (typeof email.text === "string" && email.text.trim()) {
    return email.text.trim();
  }

  if (typeof email.html === "string" && email.html.trim()) {
    return email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await parseRequestJson(req);

    if (payload.type && payload.type !== "email.received") {
      return jsonResponse({
        success: true,
        ignored: true,
        reason: `Unhandled event type: ${payload.type}`,
      });
    }

    const fromEmail = resolveFromAddress(payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const platformResendKey = Deno.env.get("RESEND_API_KEY") ?? null;

    let lead: LeadMatch | null = null;
    let isHotLead = false;
    let replyText = "";
    let rawReplyText = "";
    let clientWebhook: string | null = null;
    let replyIntentSource = "none";
    let replyIntentLabel = "unknown";
    let replyIntentReason = "";

    if (TEMPORARY_BYPASS) {
      // TEMPORARY BYPASS: Force the webhook to trigger regardless of lead status
      isHotLead = true;
      lead = {
        id: "test-id",
        client_id: null,
        email: "adedamilare1@gmail.com",
        prospect_name: null,
      };
      rawReplyText =
        (await resolveReplyText(payload, platformResendKey)) ||
        "Brute force test — I'd like to book a meeting this week.";
      replyText = splitInboundEmailReply(rawReplyText).freshReply || rawReplyText;
      console.warn("[inbound-webhook] TEMPORARY_BYPASS active — skipping DB lookup and writes");
    } else {
      const { data: fetchedLead, error: leadError } = await supabaseAdmin
        .from("leads")
        .select("id, client_id, email, prospect_name")
        .ilike("email", fromEmail)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError) {
        throw new Error(`Lead lookup failed: ${leadError.message}`);
      }

      if (!fetchedLead?.id) {
        console.info("[inbound-webhook] No lead for", fromEmail);
        return jsonResponse({
          success: true,
          matched: false,
          from: fromEmail,
          message: "No matching lead",
        });
      }

      lead = fetchedLead as LeadMatch;

      let resendApiKey = platformResendKey;
      let deepseekApiKey: string | null = null;
      if (lead.client_id) {
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("resend_api_key, slack_webhook_url, deepseek_api_key")
          .eq("id", lead.client_id)
          .maybeSingle();

        if (client?.resend_api_key) {
          resendApiKey = client.resend_api_key;
        }
        clientWebhook = client?.slack_webhook_url ?? null;
        deepseekApiKey = client?.deepseek_api_key ?? null;
      }

      rawReplyText = await resolveReplyText(payload, resendApiKey);

      if (!rawReplyText) {
        return jsonResponse({
          success: false,
          matched: true,
          leadId: lead.id,
          error: "Reply text is empty; include text in payload or configure RESEND_API_KEY for email.received fetch",
        }, 422);
      }

      replyText = splitInboundEmailReply(rawReplyText).freshReply || rawReplyText;

      const intent = await classifyReplyIntent(replyText, deepseekApiKey);
      isHotLead = intent.isHotLead;
      replyIntentSource = intent.source;
      replyIntentLabel = intent.intent;
      replyIntentReason = intent.reason;
    }

    const now = new Date().toISOString();

    let replyRow: { id: string; created_at: string } | null = null;

    if (!TEMPORARY_BYPASS) {
      const { data: existingLead } = await supabaseAdmin
        .from("leads")
        .select("form_data")
        .eq("id", lead!.id)
        .maybeSingle();

      const priorFormData =
        existingLead?.form_data && typeof existingLead.form_data === "object"
          ? (existingLead.form_data as Record<string, unknown>)
          : {};

      const form_data = {
        ...priorFormData,
        inbound_reply: replyText || null,
        inbound_received_at: now,
        inbound_intent: replyIntentLabel,
        inbound_intent_source: replyIntentSource,
        inbound_intent_reason: replyIntentReason || null,
      };

      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({
          status: "replied",
          queue_status: "completed",
          next_send_date: null,
          last_activity: now,
          is_hot_lead: isHotLead,
          form_data,
        })
        .eq("id", lead!.id);

      if (leadUpdateError) {
        throw new Error(`Failed to update lead: ${leadUpdateError.message}`);
      }

      const { data: insertedReply, error: replyError } = await supabaseAdmin
        .from("replies")
        .insert({
          lead_id: lead!.id,
          text: replyText,
        })
        .select("id, created_at")
        .single();

      if (replyError) {
        throw new Error(`Failed to insert reply: ${replyError.message}`);
      }

      replyRow = insertedReply;
    }

    let slackNotified = false;
    let slackSource = "none";
    let notionPageUrl: string | null = null;

    if (isHotLead) {
      const prospectLabel = buildProspectLabel(lead!, fromEmail);
      const replySnippet = truncateText(replyText, REPLY_SNIPPET_MAX_LENGTH);
      const outboundUrl = buildOutboundQueueUrl(lead!.client_id);

      const slackResult = await notifySlackHotLead({
        clientWebhook,
        prospectLabel,
        replySnippet,
        outboundUrl,
      });
      slackNotified = slackResult.ok;
      slackSource = slackResult.source;

      notionPageUrl = await createNotionHotLeadEntry({
        prospectEmail: fromEmail,
        replyText: rawReplyText || replyText,
      });
    }

    console.info("[inbound-webhook] Processed reply", {
      leadId: lead!.id,
      from: fromEmail,
      isHotLead,
      replyIntent: replyIntentLabel,
      replyIntentSource,
      slackNotified,
      slackSource,
      notionPageUrl,
      temporaryBypass: TEMPORARY_BYPASS,
    });

    return jsonResponse({
      success: true,
      matched: true,
      leadId: lead!.id,
      replyId: replyRow?.id ?? null,
      is_hot_lead: isHotLead,
      reply_intent: replyIntentLabel,
      reply_intent_source: replyIntentSource,
      last_activity: now,
      slack_notified: slackNotified,
      slack_source: slackSource,
      notion_page_url: notionPageUrl,
      temporary_bypass: TEMPORARY_BYPASS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isJsonError = message.includes("JSON") || message.includes("Content-Type");

    console.error("[inbound-webhook] ERROR:", message);

    return jsonResponse(
      { success: false, error: message },
      isJsonError ? 400 : 500,
    );
  }
});
