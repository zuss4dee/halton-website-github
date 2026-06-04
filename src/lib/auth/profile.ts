import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthProfile } from "./types";

export async function fetchAuthProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, client_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] profile lookup:", error);
    return null;
  }

  if (!data?.id || (data.role !== "admin" && data.role !== "client")) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    client_id: data.client_id ?? null,
  };
}
