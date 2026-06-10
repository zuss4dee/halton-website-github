import { PENDING_APPROVAL_QUEUE_STATUSES } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export async function countPendingApprovalQueue(clientId: string): Promise<number> {
  const trimmed = clientId.trim();
  if (!trimmed) return 0;

  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", trimmed)
    .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES]);

  if (error) {
    console.error("[clearApprovalQueue] count:", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function clearPendingApprovalQueue(
  clientId: string,
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const trimmed = clientId.trim();
  if (!trimmed) {
    return { ok: false, error: "Workspace context is missing." };
  }

  const { count, error: countError } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", trimmed)
    .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES]);

  if (countError) {
    console.error("[clearApprovalQueue] count:", countError);
    return { ok: false, error: countError.message };
  }

  const pendingCount = count ?? 0;
  if (pendingCount === 0) {
    return { ok: true, deleted: 0 };
  }

  const { error: deleteError } = await supabase
    .from("leads")
    .delete()
    .eq("client_id", trimmed)
    .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES]);

  if (deleteError) {
    console.error("[clearApprovalQueue] delete:", deleteError);
    return { ok: false, error: deleteError.message };
  }

  return { ok: true, deleted: pendingCount };
}
