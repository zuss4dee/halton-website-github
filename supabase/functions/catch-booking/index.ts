import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const leadName = body.payload?.attendees?.[0]?.name || "Unknown Lead";
    const leadEmail = body.payload?.attendees?.[0]?.email || "no-email@provided.com";
    const leadCompany =
      body.payload?.responses?.company?.value ||
      body.payload?.responses?.Company?.value ||
      "Unknown Company";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("notion_api_key, notion_database_id, slack_webhook_url, meetings_booked")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      throw new Error(clientError?.message ?? "Client not found");
    }

    let notionPageUrl: string | null = null;

    if (client.notion_api_key && client.notion_database_id) {
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
      } else if (typeof result === "object" && result !== null && "url" in result) {
        notionPageUrl = String((result as { url: string }).url);
      }
    } else {
      console.warn("[catch-booking] Notion keys not configured — skipping CRM write");
    }

    const priorMeetings =
      typeof client.meetings_booked === "number" && Number.isFinite(client.meetings_booked)
        ? client.meetings_booked
        : 0;

    const { error: meetingsError } = await supabase
      .from("clients")
      .update({ meetings_booked: priorMeetings + 1 })
      .eq("id", clientId);

    if (meetingsError) {
      console.error("[catch-booking] meetings_booked increment failed:", meetingsError.message);
    }

    if (client.slack_webhook_url) {
      const crmLine = notionPageUrl
        ? `*CRM Link:* <${notionPageUrl}|View Dossier in Notion>`
        : "*CRM:* Notion not configured for this workspace";

      const slackResponse = await fetch(client.slack_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
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
              text: {
                type: "mrkdwn",
                text: crmLine,
              },
            },
          ],
        }),
      });

      if (!slackResponse.ok) {
        const slackBody = await slackResponse.text();
        console.error("SLACK_WEBHOOK_FAILED:", slackResponse.status, slackBody);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: notionPageUrl,
        meetingsBooked: priorMeetings + 1,
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
