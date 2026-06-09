import { getSupabaseServer } from "@/lib/supabase-server";

import {
  formatKnowledgeCategoryLabel,
  type ClientKnowledgeRow,
  type ClientKnowledgeSearchResult,
  type KnowledgeCategory,
  type SaveToKnowledgeVaultInput,
  type VaultSaveCategory,
} from "@/lib/admin/clientKnowledge";

function readKnowledgeContent(row: ClientKnowledgeRow): string {
  const value = row.content ?? "";
  return typeof value === "string" ? value.trim() : "";
}

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

  const { data, error } = await getSupabaseServer()
    .from("clients")
    .select("id")
    .eq("slug", trimmed)
    .single();

  if (error || !data?.id) {
    return { error: `Could not find a client matching slug "${trimmed}"` };
  }

  return { clientId: data.id };
}

export async function searchClientKnowledge(
  clientId: string,
  category?: KnowledgeCategory,
): Promise<ClientKnowledgeSearchResult | { error: string }> {
  const supabase = getSupabaseServer();
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

  const { data, error } = await getSupabaseServer()
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
