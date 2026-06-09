import {
  LEAD_QUEUE_STATUS,
  PENDING_APPROVAL_QUEUE_STATUSES,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type LeadsCrmMetrics = {
  totalLeads: number;
  pendingApprovals: number;
  activeSends: number;
  completedOrBounced: number;
};

export type LeadsCrmPageResult = {
  rows: LeadRow[];
  total: number;
};

export const LEADS_CRM_PAGE_SIZE = 50;

export async function fetchLeadsCrmMetrics(clientId: string): Promise<LeadsCrmMetrics> {
  const pendingStatuses = [...PENDING_APPROVAL_QUEUE_STATUSES];

  const [total, pending, active, completed, bouncedFailed] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("queue_status", pendingStatuses),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("queue_status", LEAD_QUEUE_STATUS.ACTIVE),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("queue_status", LEAD_QUEUE_STATUS.COMPLETED),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .or("status.eq.send_failed,status.eq.bounced,status.eq.failed,email_status.eq.BOUNCED,email_status.eq.bounced"),
  ]);

  if (total.error) console.error("[leads-crm] total count:", total.error);
  if (pending.error) console.error("[leads-crm] pending count:", pending.error);
  if (active.error) console.error("[leads-crm] active count:", active.error);
  if (completed.error) console.error("[leads-crm] completed count:", completed.error);
  if (bouncedFailed.error) console.error("[leads-crm] bounced/failed count:", bouncedFailed.error);

  return {
    totalLeads: total.count ?? 0,
    pendingApprovals: pending.count ?? 0,
    activeSends: active.count ?? 0,
    completedOrBounced: (completed.count ?? 0) + (bouncedFailed.count ?? 0),
  };
}

export async function fetchLeadsCrmPage(
  clientId: string,
  page: number,
  pageSize = LEADS_CRM_PAGE_SIZE,
): Promise<LeadsCrmPageResult> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[leads-crm] page fetch:", error);
    return { rows: [], total: 0 };
  }

  return {
    rows: (data as LeadRow[]) ?? [],
    total: count ?? 0,
  };
}
