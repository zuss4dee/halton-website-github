import {
  readInboundReplyFromLead,
  readInboundSubjectFromLead,
  truncateReplyPreview,
} from "@/lib/admin/inboundReply";
import type { ClientRow, LeadRow } from "@/lib/admin/leadsRepository";
import { countLeadsWithInboundReply, fetchLeadsWithInboundReplies } from "@/lib/admin/inboundReplyAnalytics";
import { formatReplyRate } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClientWorkspaceMetrics = {
  emailsSent: number;
  totalReplies: number;
  openRatePercent: string;
  openRateCaption: string;
};

export type LiveLeadSignalRow = LeadRow & {
  replyPreview: string;
  replySubject: string | null;
};

export type ClientWorkspacePayload = {
  client: ClientRow | null;
  metrics: ClientWorkspaceMetrics;
  signals: LiveLeadSignalRow[];
  error: string | null;
};

function formatOpenRate(replies: number, sent: number): { value: string; caption: string } {
  const value = formatReplyRate(replies, sent);
  if (value === "—") {
    return { value, caption: "NO_SENDS_RECORDED" };
  }
  return {
    value,
    caption: "REPLIES ÷ SENT // ENGAGEMENT_PROXY",
  };
}

async function resolveClient(clientIdParam: string): Promise<ClientRow | null> {
  const trimmed = clientIdParam.trim();
  if (!trimmed) return null;

  const isUuid = UUID_PATTERN.test(trimmed);
  const query = supabase.from("clients").select("*");

  const { data, error } = isUuid
    ? await query.eq("id", trimmed).maybeSingle()
    : await query.eq("slug", trimmed).maybeSingle();

  if (error) {
    console.error("[workspace] client lookup:", error);
    return null;
  }

  return (data as ClientRow) ?? null;
}

export async function fetchClientWorkspaceData(
  clientIdParam: string,
): Promise<ClientWorkspacePayload> {
  const client = await resolveClient(clientIdParam);

  if (!client?.id) {
    return {
      client: null,
      metrics: {
        emailsSent: 0,
        totalReplies: 0,
        openRatePercent: "—",
        openRateCaption: "CLIENT_NOT_FOUND",
      },
      signals: [],
      error: "Client workspace not found.",
    };
  }

  const clientId = client.id;

  const [sentRes, leadsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .not("sent_at", "is", null),
    fetchLeadsWithInboundReplies(supabase, clientId),
  ]);

  const totalReplies = await countLeadsWithInboundReply(supabase, clientId);

  if (sentRes.error) console.error("[workspace] sent count:", sentRes.error);

  const emailsSent = sentRes.count ?? 0;
  const openRate = formatOpenRate(totalReplies, emailsSent);

  const leads = leadsRes;
  const leadIds = leads.map((lead) => lead.id).filter(Boolean);

  const replyPreviewByLeadId: Record<string, string> = {};

  if (leadIds.length > 0) {
    const { data: replies, error: repliesError } = await supabase
      .from("replies")
      .select("lead_id, text, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    if (repliesError) {
      console.error("[workspace] replies fetch:", repliesError);
    } else {
      for (const row of replies ?? []) {
        const leadId = row.lead_id as string;
        if (!leadId || replyPreviewByLeadId[leadId]) continue;
        const text = typeof row.text === "string" ? row.text.trim() : "";
        if (text) replyPreviewByLeadId[leadId] = text;
      }
    }
  }

  const signals: LiveLeadSignalRow[] = leads.map((lead) => {
    const fromForm = readInboundReplyFromLead(lead);
    const fromReplies = replyPreviewByLeadId[lead.id] ?? "";
    const raw = fromForm || fromReplies;

    return {
      ...lead,
      replyPreview: raw ? truncateReplyPreview(raw, 160) : "",
      replySubject: readInboundSubjectFromLead(lead),
    };
  });

  return {
    client,
    metrics: {
      emailsSent,
      totalReplies,
      openRatePercent: openRate.value,
      openRateCaption: openRate.caption,
    },
    signals,
    error: null,
  };
}
