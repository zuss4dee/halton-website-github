import { supabase } from "@/lib/supabase";

export type CredentialScope = "global" | "client";

export type CredentialRow = {
  id: string;
  name: string;
  value: string;
  scope: CredentialScope;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CredentialListItem = Omit<CredentialRow, "value"> & {
  value: string;
  maskedValue: string;
};

const CLIENT_COLUMN_BY_KEY: Record<string, string> = {
  APOLLO_API_KEY: "apollo_api_key",
  DEEPSEEK_API_KEY: "deepseek_api_key",
  RESEND_API_KEY: "resend_api_key",
  FIRECRAWL_API_KEY: "firecrawl_api_key",
  NOTION_API_KEY: "notion_api_key",
  NOTION_DATABASE_ID: "notion_database_id",
  SLACK_WEBHOOK_URL: "slack_webhook_url",
  CAL_COM_API_KEY: "cal_com_api_key",
};

function maskSecret(value: string): string {
  if (!value) return "—";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(12)}${value.slice(-4)}`;
}

function normalizeKeyName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, "_");
}

export async function listCredentials(
  clientId?: string,
): Promise<{ credentials: CredentialListItem[] } | { error: string }> {
  let query = supabase
    .from("credentials")
    .select("id, name, value, scope, client_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (clientId?.trim()) {
    query = query.or(`scope.eq.global,client_id.eq.${clientId.trim()}`);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const credentials = ((data ?? []) as CredentialRow[]).map((row) => ({
    ...row,
    maskedValue: maskSecret(row.value),
  }));

  return { credentials };
}

export type UpsertCredentialInput = {
  name: string;
  value: string;
  scope: CredentialScope;
  clientId?: string | null;
};

export async function upsertCredential(
  input: UpsertCredentialInput,
): Promise<{ credential: CredentialRow } | { error: string }> {
  const name = normalizeKeyName(input.name);
  const value = input.value.trim();

  if (!name) {
    return { error: "Key name is required." };
  }

  if (!value) {
    return { error: "Key value is required." };
  }

  if (input.scope === "client" && !input.clientId?.trim()) {
    return { error: "Client is required for client-scoped keys." };
  }

  const clientId = input.scope === "client" ? input.clientId!.trim() : null;
  const now = new Date().toISOString();

  let existingQuery = supabase
    .from("credentials")
    .select("id")
    .eq("name", name)
    .eq("scope", input.scope);

  existingQuery =
    input.scope === "client"
      ? existingQuery.eq("client_id", clientId!)
      : existingQuery.is("client_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  let saved: CredentialRow | null = null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("credentials")
      .update({ value, updated_at: now })
      .eq("id", existing.id)
      .select("id, name, value, scope, client_id, created_at, updated_at")
      .single();

    if (error) return { error: error.message };
    saved = data as CredentialRow;
  } else {
    const { data, error } = await supabase
      .from("credentials")
      .insert({
        name,
        value,
        scope: input.scope,
        client_id: clientId,
        updated_at: now,
      })
      .select("id, name, value, scope, client_id, created_at, updated_at")
      .single();

    if (error) return { error: error.message };
    saved = data as CredentialRow;
  }

  if (input.scope === "client" && clientId) {
    const column = CLIENT_COLUMN_BY_KEY[name];
    if (column) {
      const { error: syncError } = await supabase
        .from("clients")
        .update({ [column]: value })
        .eq("id", clientId);

      if (syncError) {
        console.error("CREDENTIALS_CLIENT_SYNC_ERROR:", syncError);
      }
    }
  }

  return { credential: saved! };
}

export async function deleteCredential(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const { error } = await supabase.from("credentials").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export function formatCredentialUpdatedAt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}
