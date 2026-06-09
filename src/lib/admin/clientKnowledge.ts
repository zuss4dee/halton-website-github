import { supabase } from "@/lib/supabase";

export const KNOWLEDGE_CATEGORIES = ["case_study", "brand_voice", "core_offer"] as const;

export const KNOWLEDGE_VAULT_UI_CATEGORIES = [
  "brand_voice",
  "case_study",
  "core_offer",
  "objection_handling",
  "general",
] as const;

export const VAULT_SAVE_CATEGORIES = [
  ...KNOWLEDGE_CATEGORIES,
  "objection_handling",
  "general",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type KnowledgeVaultUiCategory = (typeof KNOWLEDGE_VAULT_UI_CATEGORIES)[number];
export type VaultSaveCategory = (typeof VAULT_SAVE_CATEGORIES)[number];

export type ClientKnowledgeRow = {
  id: string;
  client_id: string;
  category: string;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
};

export type ClientKnowledgeSearchResult = {
  clientId: string;
  categoryFilter: KnowledgeCategory | "all";
  entryCount: number;
  entries: Array<{
    id: string;
    category: string;
    title: string | null;
    content: string;
  }>;
  combinedContext: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveClientId(
  clientIdOrSlug: string,
): Promise<{ clientId: string } | { error: string }> {
  const trimmed = clientIdOrSlug.trim();
  if (!trimmed) {
    return { error: "clientId is required." };
  }

  if (UUID_RE.test(trimmed)) {
    return { clientId: trimmed };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", trimmed)
    .single();

  if (error || !data?.id) {
    return { error: `Could not find a client matching slug "${trimmed}"` };
  }

  return { clientId: data.id };
}

function readKnowledgeContent(row: ClientKnowledgeRow): string {
  const value = row.content ?? "";
  return typeof value === "string" ? value.trim() : "";
}

export function formatKnowledgeCategoryLabel(category: string): string {
  return category.replace(/_/g, " ").toUpperCase();
}

export type KnowledgeVaultListEntry = {
  id: string;
  client_id: string;
  category: string;
  title: string | null;
  content: string;
  created_at: string | null;
};

export async function listClientKnowledgeEntries(
  clientId: string,
): Promise<{ entries: KnowledgeVaultListEntry[] } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  const { data, error } = await supabase
    .from("client_knowledge")
    .select("id, client_id, title, content, category, created_at")
    .eq("client_id", workspaceClientId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: `Knowledge vault query failed: ${error.message}` };
  }

  const rows = (data ?? []) as ClientKnowledgeRow[];
  const entries = rows.map((row) => ({
    id: row.id,
    client_id: row.client_id,
    category: row.category,
    title: row.title?.trim() || null,
    content: readKnowledgeContent(row),
    created_at: row.created_at ?? null,
  }));

  return { entries };
}

export async function deleteClientKnowledgeEntry(
  clientId: string,
  entryId: string,
): Promise<{ success: true } | { error: string }> {
  const workspaceClientId = clientId.trim();
  const id = entryId.trim();

  if (!workspaceClientId || !id) {
    return { error: "clientId and entry id are required." };
  }

  const { error } = await supabase
    .from("client_knowledge")
    .delete()
    .eq("id", id)
    .eq("client_id", workspaceClientId);

  if (error) {
    return { error: `Failed to delete entry: ${error.message}` };
  }

  return { success: true };
}

export async function searchClientKnowledge(
  clientId: string,
  category?: KnowledgeCategory,
): Promise<ClientKnowledgeSearchResult | { error: string }> {
  let query = supabase
    .from("client_knowledge")
    .select("id, client_id, title, content, category, created_at")
    .eq("client_id", clientId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: `Knowledge vault query failed: ${error.message}` };
  }

  const rows = (data ?? []) as ClientKnowledgeRow[];
  const entries = rows
    .map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title?.trim() || null,
      content: readKnowledgeContent(row),
    }))
    .filter((row) => row.content.length > 0);

  const combinedContext =
    entries.length > 0
      ? entries
          .map((entry) => {
            const titleLine = entry.title ? `Title: ${entry.title}\n` : "";
            return `## ${formatKnowledgeCategoryLabel(entry.category)}\n${titleLine}${entry.content}`;
          })
          .join("\n\n---\n\n")
      : "No knowledge vault entries found for this client.";

  return {
    clientId,
    categoryFilter: category ?? "all",
    entryCount: entries.length,
    entries,
    combinedContext,
  };
}

export type SaveToKnowledgeVaultInput = {
  clientId: string;
  title: string;
  content: string;
  category: VaultSaveCategory;
};

export async function saveToKnowledgeVault(
  input: SaveToKnowledgeVaultInput,
): Promise<
  | {
      success: true;
      id: string;
      clientId: string;
      title: string;
      category: VaultSaveCategory;
    }
  | { error: string }
> {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) {
    return { error: "title is required." };
  }

  if (!content) {
    return { error: "content is required." };
  }

  const { data, error } = await supabase
    .from("client_knowledge")
    .insert({
      client_id: input.clientId,
      title,
      content,
      category: input.category,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      error: `Failed to save knowledge vault entry: ${error?.message ?? "Unknown error"}`,
    };
  }

  return {
    success: true,
    id: data.id,
    clientId: input.clientId,
    title,
    category: input.category,
  };
}

export type UpdateKnowledgeVaultInput = {
  clientId: string;
  entryId: string;
  title: string;
  content: string;
  category: VaultSaveCategory;
};

export async function updateClientKnowledgeEntry(
  input: UpdateKnowledgeVaultInput,
): Promise<
  | {
      success: true;
      id: string;
      clientId: string;
      title: string;
      category: VaultSaveCategory;
    }
  | { error: string }
> {
  const title = input.title.trim();
  const content = input.content.trim();
  const entryId = input.entryId.trim();
  const clientId = input.clientId.trim();

  if (!clientId || !entryId) {
    return { error: "clientId and entry id are required." };
  }

  if (!title) {
    return { error: "title is required." };
  }

  if (!content) {
    return { error: "content is required." };
  }

  const { data, error } = await supabase
    .from("client_knowledge")
    .update({
      title,
      content,
      category: input.category,
    })
    .eq("id", entryId)
    .eq("client_id", clientId)
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      error: `Failed to update knowledge vault entry: ${error?.message ?? "Unknown error"}`,
    };
  }

  return {
    success: true,
    id: data.id,
    clientId,
    title,
    category: input.category,
  };
}

export function toKnowledgeVaultUiCategory(category: string): KnowledgeVaultUiCategory {
  if (
    (KNOWLEDGE_VAULT_UI_CATEGORIES as readonly string[]).includes(category)
  ) {
    return category as KnowledgeVaultUiCategory;
  }
  return "general";
}
