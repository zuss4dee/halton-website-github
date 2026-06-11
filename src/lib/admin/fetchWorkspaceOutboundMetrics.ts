import { countLeadsWithInboundReply } from "@/lib/admin/inboundReplyAnalytics";
import { formatReplyRate } from "@/lib/admin/leadsRepository";
import {
  ACTIVE_OUTBOUND_QUEUE_STATUSES,
  PENDING_APPROVAL_QUEUE_STATUSES,
} from "@/lib/admin/leadsRepository";
import { getSupabaseServer } from "@/lib/supabase-server";

export type WorkspaceOutboundMetrics = {
  client_id: string;
  total_prospects: number;
  emails_sent: number;
  inbox_replies: number;
  awaiting_reply: number;
  pending_review: number;
  reply_rate: string;
  source: "leads_table";
  notes: string;
};

export async function fetchWorkspaceOutboundMetrics(
  workspaceClientId: string,
): Promise<WorkspaceOutboundMetrics | { error: string }> {
  const clientId = workspaceClientId.trim();
  if (!clientId) {
    return { error: "workspace client id is required." };
  }

  const supabase = getSupabaseServer();

  const [total, pending, emailsSent, activeOutbound, inboxReplies] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("queue_status", [...PENDING_APPROVAL_QUEUE_STATUSES]),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .not("sent_at", "is", null),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("queue_status", [...ACTIVE_OUTBOUND_QUEUE_STATUSES]),
    countLeadsWithInboundReply(supabase, clientId),
  ]);

  if (total.error) {
    console.error("[get_workspace_outbound_metrics] total:", total.error);
    return { error: total.error.message };
  }
  if (pending.error) {
    console.error("[get_workspace_outbound_metrics] pending:", pending.error);
    return { error: pending.error.message };
  }
  if (emailsSent.error) {
    console.error("[get_workspace_outbound_metrics] sent:", emailsSent.error);
    return { error: emailsSent.error.message };
  }
  if (activeOutbound.error) {
    console.error("[get_workspace_outbound_metrics] active:", activeOutbound.error);
    return { error: activeOutbound.error.message };
  }

  const sent = emailsSent.count ?? 0;

  return {
    client_id: clientId,
    total_prospects: total.count ?? 0,
    emails_sent: sent,
    inbox_replies: inboxReplies,
    awaiting_reply: activeOutbound.count ?? 0,
    pending_review: pending.count ?? 0,
    reply_rate: formatReplyRate(inboxReplies, sent),
    source: "leads_table",
    notes:
      "emails_sent = leads with sent_at set (approved and dispatched). pending_review = human approval queue. inbox_replies = inbound reply evidence only.",
  };
}
