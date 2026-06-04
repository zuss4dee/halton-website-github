import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when the route param resolves to the client's assigned tenant id. */
export async function routeParamMatchesClientId(
  supabase: SupabaseClient,
  routeParam: string,
  profileClientId: string,
): Promise<boolean> {
  const trimmed = routeParam.trim();
  if (!trimmed) return false;
  if (trimmed === profileClientId) return true;

  if (UUID_PATTERN.test(trimmed)) {
    return false;
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    console.error("[auth] slug resolve:", error);
    return false;
  }

  return data?.id === profileClientId;
}
