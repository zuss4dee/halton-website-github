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

    const { data: client } = await supabase
      .from("clients")
      .select("notion_api_key, notion_database_id, slack_webhook_url")
      .eq("id", clientId)
      .single();

    if (!client?.notion_api_key || !client?.notion_database_id) {
      throw new Error("Missing Notion Keys in Vault");
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
      throw new Error(message);
    }

    if (client.slack_webhook_url && result.url) {
      const slackResponse = await fetch(client.slack_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🔥 Discovery Call Booked", emoji: true },
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
                text: `*CRM Link:* <${result.url}|View Dossier in Notion>`,
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

    return new Response(JSON.stringify({ success: true, url: result.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[ WEBHOOK ERROR ]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
