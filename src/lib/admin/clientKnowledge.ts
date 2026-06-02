import { supabase } from "@/lib/supabase";

export const KNOWLEDGE_CATEGORIES = ["case_study", "brand_voice", "core_offer"] as const;

export const VAULT_SAVE_CATEGORIES = [
  ...KNOWLEDGE_CATEGORIES,
  "general",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
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

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, " ").toUpperCase();
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
            return `## ${formatCategoryLabel(entry.category)}\n${titleLine}${entry.content}`;
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
