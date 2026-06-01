import { Client } from "@notionhq/client";
import { supabase } from "@/lib/supabase-server";

export type NotionLeadIntel = {
  name: string;
  company: string;
  email: string;
  aiDossier: string;
};

/**
 * Pushes researched lead intel into the tenant's Notion CRM database.
 * Server-only: reads vault credentials via service-role Supabase.
 */
export async function pushIntelToNotion(
  clientId: string,
  leadData: NotionLeadIntel,
): Promise<string> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("notion_api_key, notion_database_id")
    .eq("id", clientId)
    .single();

  if (error) {
    console.error("NOTION_VAULT_FETCH_ERROR:", error);
    throw new Error("Failed to load Notion credentials from vault.");
  }

  if (!client?.notion_api_key || !client?.notion_database_id) {
    throw new Error("Notion credentials missing.");
  }

  const notion = new Client({ auth: client.notion_api_key });

  const response = await notion.pages.create({
    parent: { database_id: client.notion_database_id },
    properties: {
      Name: { title: [{ text: { content: leadData.name } }] },
      Company: { rich_text: [{ text: { content: leadData.company } }] },
      Email: { email: leadData.email },
      Status: { select: { name: "AI Researched" } },
    },
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ text: { content: "🧠 Halton Works AI Dossier" } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: leadData.aiDossier } }] },
      },
    ],
  });

  if ("url" in response && typeof response.url === "string" && response.url) {
    return response.url;
  }

  return `https://www.notion.so/${response.id.replace(/-/g, "")}`;
}
