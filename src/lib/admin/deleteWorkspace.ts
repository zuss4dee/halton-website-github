import { supabase } from "@/lib/supabase";

export async function deleteWorkspace(
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmedId = clientId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Missing workspace id." };
  }

  const { error } = await supabase.from("clients").delete().eq("id", trimmedId);

  if (error) {
    console.error("[delete-workspace]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
