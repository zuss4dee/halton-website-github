import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { clientId } = await req.json();

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
          "Lead Name": { title: [{ text: { content: "Sarah Connor (SYSTEM TEST)" } }] },
          Company: { rich_text: [{ text: { content: "Cyberdyne Systems" } }] },
          Email: { email: "sarah@cyberdyne.com" },
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
              text: { type: "plain_text", text: "🚨 New Inbound Lead Alert", emoji: true },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Name:* Sarah Connor (SYSTEM TEST)\n*Company:* Cyberdyne Systems\n*Email:* sarah@cyberdyne.com",
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
