import { readInboundReplyFromLead } from "@/lib/admin/inboundReply";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReplyJoinRow = {
  lead_id: string;
};

/** True when the lead has a stored inbound reply body (replies row or form_data). */
export function leadHasInboundReplyEvidence(
  lead: LeadRow,
  replyLeadIds?: ReadonlySet<string>,
): boolean {
  if (replyLeadIds?.has(lead.id)) return true;
  return Boolean(readInboundReplyFromLead(lead));
}

async function fetchReplyLeadIdsForClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("replies")
    .select("lead_id, leads!inner(client_id)")
    .eq("leads.client_id", clientId);

  if (error) {
    console.error("[inboundReplyAnalytics] replies join:", error);
    return new Set();
  }

  const ids = new Set<string>();
  for (const row of (data as ReplyJoinRow[] | null) ?? []) {
    if (row.lead_id) ids.add(row.lead_id);
  }
  return ids;
}

/** Distinct leads with real inbound reply text — ignores status=replied without evidence. */
export async function countLeadsWithInboundReply(
  supabase: SupabaseClient,
  clientId: string,
): Promise<number> {
  const replyLeadIds = await fetchReplyLeadIdsForClient(supabase, clientId);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, form_data")
    .eq("client_id", clientId);

  if (error) {
    console.error("[inboundReplyAnalytics] leads scan:", error);
    return replyLeadIds.size;
  }

  const matched = new Set<string>(replyLeadIds);
  for (const row of leads ?? []) {
    const lead = row as LeadRow;
    if (leadHasInboundReplyEvidence(lead, matched)) {
      matched.add(lead.id);
    }
  }

  return matched.size;
}

export async function fetchLeadsWithInboundReplies(
  supabase: SupabaseClient,
  clientId: string,
): Promise<LeadRow[]> {
  const replyLeadIds = await fetchReplyLeadIdsForClient(supabase, clientId);

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("client_id", clientId)
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[inboundReplyAnalytics] leads fetch:", error);
    return [];
  }

  return ((data as LeadRow[]) ?? []).filter((lead) =>
    leadHasInboundReplyEvidence(lead, replyLeadIds),
  );
}
