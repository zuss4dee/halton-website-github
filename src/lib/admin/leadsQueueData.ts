import {
  LEAD_QUEUE_STATUS,
  PENDING_APPROVAL_QUEUE_STATUSES,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

/** Leads awaiting human review or final approve-and-send — same filter as CRM pending KPI. */
export async function fetchPendingApprovalLeads(clientId: string): Promise<LeadRow[]> {
  const workspaceId = clientId.trim();
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("client_id", workspaceId)
    .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES])
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[leads-queue] pending approval fetch:", error);
    return [];
  }

  return ((data as LeadRow[]) ?? []).filter((row) => row.client_id === workspaceId);
}

export async function fetchActiveSequenceLeads(clientId: string): Promise<LeadRow[]> {
  const workspaceId = clientId.trim();
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("client_id", workspaceId)
    .eq("queue_status", LEAD_QUEUE_STATUS.ACTIVE)
    .order("next_send_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[leads-queue] active sequence fetch:", error);
    return [];
  }

  return ((data as LeadRow[]) ?? []).filter((row) => row.client_id === workspaceId);
}

export async function fetchSentLeads(clientId: string): Promise<LeadRow[]> {
  const workspaceId = clientId.trim();
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("client_id", workspaceId)
    .eq("queue_status", LEAD_QUEUE_STATUS.SENT)
    .order("sent_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[leads-queue] sent fetch:", error);
    return [];
  }

  return ((data as LeadRow[]) ?? []).filter((row) => row.client_id === workspaceId);
}

export async function countPendingApprovalLeads(clientId: string): Promise<number> {
  const workspaceId = clientId.trim();
  if (!workspaceId) return 0;

  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", workspaceId)
    .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES]);

  if (error) {
    console.error("[leads-queue] pending approval count:", error);
    return 0;
  }

  return count ?? 0;
}
