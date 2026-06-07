import { useCallback, useEffect, useState } from "react";
import {
  AdminDataTable,
  AdminKpiCard,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import { HighIntentLeadDrawer } from "@/components/admin/HighIntentLeadDrawer";
import { ViewOrgChartButton } from "@/components/workspace/ViewOrgChartButton";
import {
  readInboundReplyFromLead,
  truncateReplyPreview,
} from "@/lib/admin/inboundReply";
import { LEAD_QUEUE_STATUS, type LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

type WorkspaceCommandDashboardProps = {
  clientId: string;
  companyName?: string;
};

type DashboardMetrics = {
  totalLeads: number;
  pendingReview: number;
  sentEmails: number;
  repliedLeads: number;
  totalAgentOps: number;
  isLoading: boolean;
};

const INITIAL_METRICS: DashboardMetrics = {
  totalLeads: 0,
  pendingReview: 0,
  sentEmails: 0,
  repliedLeads: 0,
  totalAgentOps: 0,
  isLoading: true,
};

function formatReplyRate(replied: number, sent: number): string {
  if (sent <= 0) return "—";
  const rate = (replied / sent) * 100;
  return `${rate.toFixed(1)}%`;
}

function formatPipelineStatus(lead: LeadRow): string {
  const status = lead.status?.trim().toLowerCase() ?? "";
  const queueStatus = lead.queue_status?.trim().toLowerCase() ?? "";
  if (status === "replied") {
    if (queueStatus === LEAD_QUEUE_STATUS.COMPLETED) return "Replied · Sequence stopped";
    if (queueStatus === LEAD_QUEUE_STATUS.PAUSED) return "Replied · Paused";
    return "Replied";
  }
  if (status === "closed_won") return "Closed Won";
  if (status === "follow_up") return "Follow-Up";
  if (status === "form_filled") return "Form Filled";
  if (status === "positive_reply") return "Positive Reply";
  if (status === "qualified") return "Qualified";
  if (lead.is_hot_lead) return "Hot Lead";
  return status ? status.replace(/_/g, " ") : "—";
}

export function WorkspaceCommandDashboard({
  clientId,
}: WorkspaceCommandDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [highIntentLeads, setHighIntentLeads] = useState<LeadRow[]>([]);
  const [replyPreviewByLeadId, setReplyPreviewByLeadId] = useState<Record<string, string>>({});
  const [isLeadsLoading, setIsLeadsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const resolveReplyPreview = (lead: LeadRow): string => {
    const fromLead = readInboundReplyFromLead(lead);
    if (fromLead) return truncateReplyPreview(fromLead);

    const fromReplies = replyPreviewByLeadId[lead.id];
    if (fromReplies) return truncateReplyPreview(fromReplies);

    return "";
  };

  const fetchMetrics = useCallback(async () => {
    setMetrics((prev) => ({ ...prev, isLoading: true }));

    const [leads, pending, sent, replied, agentOps] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("queue_status", "pending"),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("queue_status", "sent"),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "replied"),
      supabase
        .from("agent_logs")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

    if (leads.error) console.error("DASHBOARD leads count:", leads.error);
    if (pending.error) console.error("DASHBOARD pending count:", pending.error);
    if (sent.error) console.error("DASHBOARD sent count:", sent.error);
    if (replied.error) console.error("DASHBOARD replied count:", replied.error);
    if (agentOps.error) console.error("DASHBOARD agent_logs count:", agentOps.error);

    setMetrics({
      totalLeads: leads.count ?? 0,
      pendingReview: pending.count ?? 0,
      sentEmails: sent.count ?? 0,
      repliedLeads: replied.count ?? 0,
      totalAgentOps: agentOps.count ?? 0,
      isLoading: false,
    });
  }, [clientId]);

  const fetchHighIntentLeads = useCallback(async () => {
    setIsLeadsLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "replied")
      .order("last_activity", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DASHBOARD high-intent leads:", error);
      setHighIntentLeads([]);
      setReplyPreviewByLeadId({});
    } else {
      const leads = (data as LeadRow[]) ?? [];
      setHighIntentLeads(leads);

      const leadIds = leads.map((row) => row.id).filter(Boolean);
      if (leadIds.length === 0) {
        setReplyPreviewByLeadId({});
      } else {
        const { data: replies, error: repliesError } = await supabase
          .from("replies")
          .select("lead_id, text, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (repliesError) {
          console.error("DASHBOARD reply previews:", repliesError);
          setReplyPreviewByLeadId({});
        } else {
          const previewMap: Record<string, string> = {};
          for (const row of replies ?? []) {
            const leadId = row.lead_id as string;
            if (!leadId || previewMap[leadId]) continue;
            const text = typeof row.text === "string" ? row.text.trim() : "";
            if (text) previewMap[leadId] = text;
          }
          setReplyPreviewByLeadId(previewMap);
        }
      }
    }

    setIsLeadsLoading(false);
  }, [clientId]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    void fetchHighIntentLeads();
  }, [fetchHighIntentLeads]);

  const handleLeadUpdated = () => {
    void fetchHighIntentLeads();
    void fetchMetrics();
  };

  return (
    <section className="min-h-[60vh] space-y-12">
      <AdminPageHeader
        code="01 // ANALYTICS"
        title="Analytics"
        description="Workspace telemetry · replied pipeline · agent operations"
        trailing={<ViewOrgChartButton clientId={clientId} />}
      />

      <section className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
        <AdminKpiCard
          label="Reply Rate"
          value={
            metrics.isLoading
              ? "—"
              : formatReplyRate(metrics.repliedLeads, metrics.sentEmails)
          }
          isLoading={metrics.isLoading}
        />
        <AdminKpiCard
          label="Total Prospects"
          value={metrics.totalLeads.toLocaleString()}
          isLoading={metrics.isLoading}
        />
        <AdminKpiCard
          label="Active Outbound"
          value={metrics.sentEmails.toLocaleString()}
          isLoading={metrics.isLoading}
        />
        <AdminKpiCard
          label="Agent Operations"
          value={metrics.totalAgentOps.toLocaleString()}
          isLoading={metrics.isLoading}
        />
        <AdminKpiCard
          label="Pending Review"
          value={metrics.pendingReview.toLocaleString()}
          isLoading={metrics.isLoading}
        />
        <AdminKpiCard
          label="Replied Leads"
          value={metrics.repliedLeads.toLocaleString()}
          isLoading={metrics.isLoading}
        />
      </section>

      <AdminDataTable<LeadRow>
        recordLabel="High-Intent Leads"
        columns={[
          {
            key: "date",
            header: "Date",
            render: (lead) => (
              <span className="text-[10px] tracking-[0.1em] text-ink/55 uppercase tabular-nums">
                {formatAdminDate(lead.last_activity ?? lead.created_at)}
              </span>
            ),
          },
          {
            key: "prospect",
            header: "Prospect & Company",
            render: (lead) => {
              const name = lead.prospect_name?.trim() || "UNKNOWN_PROSPECT";
              const company =
                lead.target_company?.trim() || lead.company_name?.trim() || "—";
              return (
                <>
                  <span className="block text-sm tracking-[0.04em] uppercase">{name}</span>
                  <span className="mt-1 block text-[9px] tracking-[0.12em] text-ink/35 uppercase">
                    {company}
                  </span>
                </>
              );
            },
          },
          {
            key: "preview",
            header: "Reply Preview",
            render: (lead) => {
              const replyPreview = resolveReplyPreview(lead);
              return replyPreview ? (
                <span className="line-clamp-2 text-[10px] leading-relaxed text-ink/60 uppercase">
                  {replyPreview}
                </span>
              ) : (
                <span className="text-[9px] text-ink/35 uppercase">No reply text</span>
              );
            },
          },
          {
            key: "status",
            header: "Status",
            align: "right",
            render: (lead) => (
              <span className="text-[10px] tracking-[0.12em] text-ink/55 uppercase">
                {formatPipelineStatus(lead)}
              </span>
            ),
          },
        ]}
        rows={highIntentLeads}
        rowKey={(lead) => lead.id}
        isLoading={isLeadsLoading}
        emptyMessage="No replied leads yet."
        onRowClick={(lead) => setSelectedLead(lead)}
      />

      <HighIntentLeadDrawer
        lead={selectedLead}
        clientId={clientId}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </section>
  );
}
