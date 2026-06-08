import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveWorkspaceClientId(
  clientIdParam: string,
): Promise<string | null> {
  const trimmed = clientIdParam.trim();
  if (!trimmed) return null;

  const isUuid = UUID_PATTERN.test(trimmed);
  const query = supabase.from("clients").select("id");

  const { data, error } = isUuid
    ? await query.eq("id", trimmed).maybeSingle()
    : await query.eq("slug", trimmed).maybeSingle();

  if (error) {
    console.error("[resolve-workspace-client]", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}
