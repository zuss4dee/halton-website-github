import { runSystemHealthChecks, type SystemHealthReport } from "@/lib/health-check";
import { supabase } from "@/lib/supabase-server";

const CREDENTIAL_NAMES = [
  "RESEND_API_KEY",
  "NOTION_API_KEY",
  "NOTION_DATABASE_ID",
  "SLACK_WEBHOOK_URL",
] as const;

async function loadGlobalCredentials(): Promise<Record<string, string | null>> {
  const envFallback = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
    NOTION_API_KEY: process.env.NOTION_API_KEY ?? null,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID ?? null,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ?? null,
  };

  const { data, error } = await supabase
    .from("credentials")
    .select("name, value")
    .eq("scope", "global")
    .in("name", [...CREDENTIAL_NAMES]);

  if (error) {
    console.error("HEALTH_CHECK_CREDENTIALS_FETCH:", error);
    return envFallback;
  }

  const fromDb = Object.fromEntries(
    (data ?? []).map((row) => [row.name as string, (row.value as string) ?? null]),
  ) as Record<string, string | null>;

  return {
    RESEND_API_KEY: fromDb.RESEND_API_KEY ?? envFallback.RESEND_API_KEY,
    NOTION_API_KEY: fromDb.NOTION_API_KEY ?? envFallback.NOTION_API_KEY,
    NOTION_DATABASE_ID: fromDb.NOTION_DATABASE_ID ?? envFallback.NOTION_DATABASE_ID,
    SLACK_WEBHOOK_URL: fromDb.SLACK_WEBHOOK_URL ?? envFallback.SLACK_WEBHOOK_URL,
  };
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const secrets = await loadGlobalCredentials();

  return runSystemHealthChecks({
    resendApiKey: secrets.RESEND_API_KEY,
    notionApiKey: secrets.NOTION_API_KEY,
    notionDatabaseId: secrets.NOTION_DATABASE_ID,
    slackWebhookUrl: secrets.SLACK_WEBHOOK_URL,
  });
}
