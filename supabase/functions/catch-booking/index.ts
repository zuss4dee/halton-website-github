import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertLeadsChannel } from "../_shared/alerting.ts";

const COMPANY_KEY_PATTERN = /company|organization|organisation|business|employer|firm/i;

function readResponseValue(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const obj = entry as Record<string, unknown>;

  const response = obj.response;
  if (typeof response === "string" && response.trim()) return response.trim();
  if (typeof response === "number" && Number.isFinite(response)) return String(response);
  if (Array.isArray(response) && response.length > 0) {
    const first = response[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (typeof first === "object" && first !== null && "label" in first) {
      const label = (first as { label?: unknown }).label;
      if (typeof label === "string" && label.trim()) return label.trim();
    }
  }
  if (typeof response === "object" && response !== null && "label" in response) {
    const label = (response as { label?: unknown }).label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }

  const value = obj.value;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }

  return null;
}

function readFromFieldBag(bag: unknown, pattern: RegExp): string | null {
  if (!bag || typeof bag !== "object") return null;

  for (const [key, entry] of Object.entries(bag as Record<string, unknown>)) {
    if (!pattern.test(key)) continue;
    if (typeof entry === "string" && entry.trim()) return entry.trim();
    const parsed = readResponseValue(entry);
    if (parsed) return parsed;
  }

  return null;
}

function readAttendeeName(payload: Record<string, unknown>): string {
  const attendees = payload.attendees;
  if (Array.isArray(attendees) && attendees.length > 0) {
    const first = attendees[0] as Record<string, unknown>;
    if (typeof first.name === "string" && first.name.trim()) return first.name.trim();
    const firstName = typeof first.firstName === "string" ? first.firstName.trim() : "";
    const lastName = typeof first.lastName === "string" ? first.lastName.trim() : "";
    const combined = `${firstName} ${lastName}`.trim();
    if (combined) return combined;
  }

  const responses = payload.responses as Record<string, unknown> | undefined;
  const nameResponse = readResponseValue(responses?.name);
  if (nameResponse) return nameResponse;

  return "Unknown Lead";
}

function readAttendeeEmail(payload: Record<string, unknown>): string {
  const attendees = payload.attendees;
  if (Array.isArray(attendees) && attendees.length > 0) {
    const first = attendees[0] as Record<string, unknown>;
    if (typeof first.email === "string" && first.email.trim()) return first.email.trim();
  }

  const responses = payload.responses as Record<string, unknown> | undefined;
  const emailResponse = readResponseValue(responses?.email);
  if (emailResponse) return emailResponse;

  return "no-email@provided.com";
}

function readAttendeeCompany(payload: Record<string, unknown>): string | null {
  const responses = payload.responses as Record<string, unknown> | undefined;

  if (responses) {
    for (const key of ["company", "Company", "company_name", "organization", "organisation"]) {
      const value = readResponseValue(responses[key]);
      if (value) return value;
    }

    for (const [key, entry] of Object.entries(responses)) {
      if (!COMPANY_KEY_PATTERN.test(key)) continue;
      const value = readResponseValue(entry);
      if (value) return value;
    }

    for (const entry of Object.values(responses)) {
      if (!entry || typeof entry !== "object") continue;
      const label = String((entry as { label?: unknown }).label ?? "");
      if (!COMPANY_KEY_PATTERN.test(label)) continue;
      const value = readResponseValue(entry);
      if (value) return value;
    }
  }

  return (
    readFromFieldBag(payload.customInputs, COMPANY_KEY_PATTERN) ??
    readFromFieldBag(payload.userFieldsResponses, COMPANY_KEY_PATTERN)
  );
}

async function lookupCompanyFromCrm(
  supabase: SupabaseClient,
  clientId: string,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized === "no-email@provided.com") return null;

  const { data, error } = await supabase
    .from("leads")
    .select("target_company")
    .eq("client_id", clientId)
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[catch-booking] CRM company lookup failed:", error.message);
    return null;
  }

  const company = data?.target_company?.trim();
  return company || null;
}

async function notifyBookingSlack(
  clientWebhook: string | null | undefined,
  message: string,
  blocks: Record<string, unknown>[],
): Promise<{ ok: boolean; source: string; error?: string }> {
  if (clientWebhook?.trim()) {
    const slackResponse = await fetch(clientWebhook.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (slackResponse.ok) {
      return { ok: true, source: "client_webhook" };
    }

    const slackBody = await slackResponse.text();
    console.error("SLACK_WEBHOOK_FAILED:", slackResponse.status, slackBody);
    return {
      ok: false,
      source: "client_webhook",
      error: `Slack webhook failed (${slackResponse.status})`,
    };
  }

  const platform = await alertLeadsChannel(message);
  if (platform.ok) {
    return { ok: true, source: "platform_env" };
  }

  return {
    ok: false,
    source: "none",
    error: platform.error ?? "No Slack webhook configured on client or platform env",
  };
}

type ClientRow = {
  notion_api_key: string | null;
  notion_database_id: string | null;
  slack_webhook_url: string | null;
  meetings_booked: number | null;
};

async function writeNotionLead(
  client: ClientRow,
  leadName: string,
  leadCompany: string,
  leadEmail: string,
): Promise<string | null> {
  if (!client.notion_api_key || !client.notion_database_id) {
    console.warn("[catch-booking] Notion keys not configured — skipping CRM write");
    return null;
  }

  const notionResponse = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.notion_api_key}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: client.notion_database_id },
      properties: {
        "Lead Name": { title: [{ text: { content: leadName } }] },
        Company: { rich_text: [{ text: { content: leadCompany } }] },
        Email: { email: leadEmail },
        Status: { status: { name: "Incoming" } },
      },
    }),
  });

  const result = await notionResponse.json();

  if (!notionResponse.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String((result as { message: string }).message)
        : "Notion API request failed";
    console.error("[catch-booking] Notion write failed:", message);
    return null;
  }

  if (typeof result === "object" && result !== null && "url" in result) {
    return String((result as { url: string }).url);
  }

  return null;
}

async function incrementMeetingsBooked(
  supabase: SupabaseClient,
  clientId: string,
  priorMeetings: number,
): Promise<number | null> {
  const { error: meetingsError } = await supabase
    .from("clients")
    .update({ meetings_booked: priorMeetings + 1 })
    .eq("id", clientId);

  if (meetingsError) {
    console.error("[catch-booking] meetings_booked increment failed:", meetingsError.message);
    return null;
  }

  return priorMeetings + 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    if (!clientId) throw new Error("Missing clientId in webhook URL");

    const body = await req.json();

    const triggerEvent = body.triggerEvent;
    if (triggerEvent !== "BOOKING_CREATED") {
      return new Response(JSON.stringify({ message: "Ignored non-creation event." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload =
      body.payload && typeof body.payload === "object"
        ? (body.payload as Record<string, unknown>)
        : {};

    const leadName = readAttendeeName(payload);
    const leadEmail = readAttendeeEmail(payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("notion_api_key, notion_database_id, slack_webhook_url, meetings_booked")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      throw new Error(clientError.message);
    }

    if (!client) {
      console.warn(
        "[catch-booking] Ignoring booking — unknown clientId (remove stale Cal.com webhook):",
        clientId,
      );
      return new Response(
        JSON.stringify({
          ignored: true,
          reason: "unknown_client",
          clientId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const leadCompanyFromCal = readAttendeeCompany(payload);
    const leadCompanyFromCrm =
      leadCompanyFromCal ??
      (await lookupCompanyFromCrm(supabase, clientId, leadEmail));
    const leadCompany = leadCompanyFromCrm ?? "Unknown Company";

    const crmLine = client.notion_api_key && client.notion_database_id
      ? "*CRM:* Notion sync running in background"
      : "*CRM:* Notion not configured for this workspace";

    const slackMessage = `Discovery call booked\nLead: ${leadName}\nCompany: ${leadCompany}\nEmail: ${leadEmail}`;

    const slackResult = await notifyBookingSlack(
      client.slack_webhook_url,
      slackMessage,
      [
        {
          type: "header",
          text: { type: "plain_text", text: "Discovery Call Booked", emoji: true },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Lead:* ${leadName}\n*Company:* ${leadCompany}\n*Email:* ${leadEmail}`,
          },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: crmLine },
        },
      ],
    );

    if (!slackResult.ok) {
      console.warn("[catch-booking] Slack notification failed:", slackResult.error);
    }

    const priorMeetings =
      typeof client.meetings_booked === "number" && Number.isFinite(client.meetings_booked)
        ? client.meetings_booked
        : 0;

    const backgroundWork = (async () => {
      const notionPageUrl = await writeNotionLead(client, leadName, leadCompany, leadEmail);
      const meetingsBooked = await incrementMeetingsBooked(supabase, clientId, priorMeetings);

      console.log("[catch-booking] background complete", {
        clientId,
        notionPageUrl,
        meetingsBooked,
        companySource: leadCompanyFromCal
          ? "cal.com"
          : leadCompanyFromCrm
            ? "crm"
            : "unknown",
      });
    })();

    // @ts-ignore Supabase edge runtime extension
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore Supabase edge runtime extension
      EdgeRuntime.waitUntil(backgroundWork);
    } else {
      await backgroundWork;
    }

    return new Response(
      JSON.stringify({
        success: true,
        slackNotified: slackResult.ok,
        slackSource: slackResult.source,
        slackError: slackResult.error ?? null,
        company: leadCompany,
        companySource: leadCompanyFromCal
          ? "cal.com"
          : leadCompanyFromCrm
            ? "crm"
            : "unknown",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("[ WEBHOOK ERROR ]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
