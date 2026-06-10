import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type VaultKeys = {
  apollo_api_key: string | null;
  deepseek_api_key: string;
  resend_api_key: string;
  firecrawl_api_key: string | null;
};

const CREDENTIAL_NAMES = [
  "APOLLO_API_KEY",
  "DEEPSEEK_API_KEY",
  "RESEND_API_KEY",
  "FIRECRAWL_API_KEY",
] as const;

const CREDENTIAL_TO_COLUMN: Record<(typeof CREDENTIAL_NAMES)[number], keyof VaultKeys> = {
  APOLLO_API_KEY: "apollo_api_key",
  DEEPSEEK_API_KEY: "deepseek_api_key",
  RESEND_API_KEY: "resend_api_key",
  FIRECRAWL_API_KEY: "firecrawl_api_key",
};

const ENV_FALLBACKS: Record<keyof VaultKeys, string[]> = {
  apollo_api_key: ["APOLLO_API_KEY", "apollo_api_key"],
  deepseek_api_key: ["DEEPSEEK_API_KEY", "deepseek_api_key", "VITE_DEEPSEEK_API_KEY"],
  resend_api_key: ["RESEND_API_KEY", "resend_api_key", "VITE_RESEND_API_KEY"],
  firecrawl_api_key: ["FIRECRAWL_API_KEY", "firecrawl_api_key"],
};

function trimOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function readDenoEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * Resolves API keys for run-outbound in priority order:
 * 1. clients table columns (Workspace Infrastructure UI)
 * 2. credentials table (client-scoped, then global)
 * 3. Edge Function secrets / env vars (e.g. DEEPSEEK_API_KEY)
 */
export async function resolveVaultKeys(
  supabaseAdmin: SupabaseClient,
  clientId: string,
): Promise<{ keys: VaultKeys; sources: Partial<Record<keyof VaultKeys, string>> }> {
  const sources: Partial<Record<keyof VaultKeys, string>> = {};

  const { data: clientData } = await supabaseAdmin
    .from("clients")
    .select("apollo_api_key, deepseek_api_key, resend_api_key, firecrawl_api_key")
    .eq("id", clientId)
    .maybeSingle();

  const keys: VaultKeys = {
    apollo_api_key: trimOrEmpty(clientData?.apollo_api_key) || null,
    deepseek_api_key: trimOrEmpty(clientData?.deepseek_api_key),
    resend_api_key: trimOrEmpty(clientData?.resend_api_key),
    firecrawl_api_key: trimOrEmpty(clientData?.firecrawl_api_key) || null,
  };

  if (keys.apollo_api_key) sources.apollo_api_key = "clients";
  if (keys.deepseek_api_key) sources.deepseek_api_key = "clients";
  if (keys.resend_api_key) sources.resend_api_key = "clients";
  if (keys.firecrawl_api_key) sources.firecrawl_api_key = "clients";

  const { data: credentialRows } = await supabaseAdmin
    .from("credentials")
    .select("name, value, scope, client_id")
    .in("name", [...CREDENTIAL_NAMES])
    .or(`scope.eq.global,and(scope.eq.client,client_id.eq.${clientId})`);

  const byName = new Map<string, { value: string; scope: string }>();

  for (const row of credentialRows ?? []) {
    const name = String(row.name ?? "").trim().toUpperCase();
    const value = trimOrEmpty(row.value as string | null | undefined);
    if (!name || !value) continue;

    const existing = byName.get(name);
    const isClientScoped = row.scope === "client" && row.client_id === clientId;

    if (!existing || (isClientScoped && existing.scope !== "client")) {
      byName.set(name, { value, scope: isClientScoped ? "client" : "global" });
    }
  }

  for (const credName of CREDENTIAL_NAMES) {
    const column = CREDENTIAL_TO_COLUMN[credName];
    if (keys[column]) continue;

    const cred = byName.get(credName);
    if (!cred) continue;

    if (column === "apollo_api_key" || column === "firecrawl_api_key") {
      keys[column] = cred.value;
    } else {
      keys[column] = cred.value;
    }
    sources[column] = `credentials:${cred.scope}`;
  }

  for (const column of Object.keys(ENV_FALLBACKS) as Array<keyof VaultKeys>) {
    if (keys[column]) continue;

    const envValue = readDenoEnv(...ENV_FALLBACKS[column]);
    if (!envValue) continue;

    if (column === "apollo_api_key" || column === "firecrawl_api_key") {
      keys[column] = envValue;
    } else {
      keys[column] = envValue;
    }
    sources[column] = "env";
  }

  return { keys, sources };
}

export function formatMissingVaultKeyError(missing: keyof VaultKeys): string {
  const hints: Record<keyof VaultKeys, string> = {
    apollo_api_key:
      "Set apollo_api_key on Workspace Infrastructure, credentials APOLLO_API_KEY, or Edge secret APOLLO_API_KEY.",
    deepseek_api_key:
      "Set deepseek_api_key on Workspace Infrastructure (clients table), credentials DEEPSEEK_API_KEY, or Edge Function secret DEEPSEEK_API_KEY — not Supabase Vault.",
    resend_api_key:
      "Set resend_api_key on Workspace Infrastructure, credentials RESEND_API_KEY, or Edge secret RESEND_API_KEY.",
  };

  return `Missing required vault key (${missing}). ${hints[missing]}`;
}
