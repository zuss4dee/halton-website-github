import { useCallback, useEffect, useState } from "react";
import { HighIntentLeadDrawer } from "@/components/admin/HighIntentLeadDrawer";
import {
  buildManualFollowUpLeadsFilter,
  LEAD_QUEUE_STATUS,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
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

type MetricCardProps = {
  descriptor: string;
  value?: number;
  displayValue?: string;
  isLoading: boolean;
  caption: string;
};

function formatReplyRate(replied: number, sent: number): string {
  if (sent <= 0) return "—";
  const rate = (replied / sent) * 100;
  return `${rate.toFixed(1)}%`;
}

function formatTableDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function deriveSourceLabel(lead: LeadRow): string {
  const status = lead.status?.trim().toLowerCase() ?? "";
  const queueStatus = lead.queue_status?.trim().toLowerCase() ?? "";
  if (status === "form_filled") return "Form";
  if (
    status === "positive_reply" ||
    status === "replied" ||
    queueStatus === LEAD_QUEUE_STATUS.PAUSED ||
    lead.is_hot_lead
  ) {
    return "Reply";
  }
  if (status === "qualified") return "Qualified";
  return "Reply";
}

function formatPipelineStatus(lead: LeadRow): string {
  const status = lead.status?.trim().toLowerCase() ?? "";
  const queueStatus = lead.queue_status?.trim().toLowerCase() ?? "";
  if (queueStatus === LEAD_QUEUE_STATUS.PAUSED) return "Paused";
  if (status === "closed_won") return "Closed Won";
  if (status === "follow_up") return "Follow-Up";
  if (status === "form_filled") return "Form Filled";
  if (status === "positive_reply") return "Positive Reply";
  if (status === "replied") return "Replied";
  if (status === "qualified") return "Qualified";
  if (lead.is_hot_lead) return "Hot Lead";
  return status ? status.replace(/_/g, " ") : "—";
}

function MetricCard({ descriptor, value, displayValue, isLoading, caption }: MetricCardProps) {
  const renderedValue =
    displayValue ??
    (typeof value === "number" ? value.toLocaleString() : "—");

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-gray-300">
      <header className="border-b border-gray-100 pb-3">
        <p className="text-sm font-medium text-gray-700">{descriptor}</p>
      </header>
      <p className="mt-4 text-3xl leading-none tabular-nums tracking-tight sm:text-4xl">
        {isLoading ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className="font-semibold text-emerald-600">{renderedValue}</span>
        )}
      </p>
      <span className="mt-2 block text-xs text-gray-500">{caption}</span>
    </article>
  );
}

export function WorkspaceCommandDashboard({
  clientId,
}: WorkspaceCommandDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [highIntentLeads, setHighIntentLeads] = useState<LeadRow[]>([]);
  const [isLeadsLoading, setIsLeadsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

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
      .or(buildManualFollowUpLeadsFilter())
      .order("last_activity", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DASHBOARD high-intent leads:", error);
      setHighIntentLeads([]);
    } else {
      setHighIntentLeads((data as LeadRow[]) ?? []);
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
    <section className="min-h-[60vh]">
      <header className="mb-10 border-b border-gray-200 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
      </header>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          descriptor="Reply Rate"
          displayValue={
            metrics.isLoading
              ? undefined
              : formatReplyRate(metrics.repliedLeads, metrics.sentEmails)
          }
          isLoading={metrics.isLoading}
          caption={`${metrics.repliedLeads.toLocaleString()} replied / ${metrics.sentEmails.toLocaleString()} emails sent`}
        />
        <MetricCard
          descriptor="Total Prospects"
          value={metrics.totalLeads}
          isLoading={metrics.isLoading}
          caption="Total leads scraped/ingested"
        />
        <MetricCard
          descriptor="Active Outbound"
          value={metrics.sentEmails}
          isLoading={metrics.isLoading}
          caption="Prospects in automated sequences"
        />
        <MetricCard
          descriptor="Positive Intent"
          value={metrics.totalAgentOps}
          isLoading={metrics.isLoading}
          caption="Form fills and direct replies"
        />
        <MetricCard
          descriptor="Closed Won"
          value={metrics.pendingReview}
          isLoading={metrics.isLoading}
          caption="Signed clients / Active revenue"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-display text-lg tracking-tight text-gray-900">
            High-Intent Leads (Ready to Close)
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Inbound replies and paused outreach — updated automatically from the webhook.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th
                  scope="col"
                  className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500"
                >
                  [ DATE ]
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500"
                >
                  [ PROSPECT & COMPANY ]
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500"
                >
                  [ SOURCE (Form / Reply) ]
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500"
                >
                  [ STATUS ]
                </th>
              </tr>
            </thead>
            <tbody>
              {isLeadsLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                    Loading replied and paused leads…
                  </td>
                </tr>
              ) : highIntentLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                    No replied or paused leads yet.
                  </td>
                </tr>
              ) : (
                highIntentLeads.map((lead) => {
                  const name = lead.prospect_name?.trim() || "Unknown Prospect";
                  const company = lead.target_company?.trim() || lead.company_name?.trim() || "—";

                  return (
                    <tr
                      key={lead.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLead(lead)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedLead(lead);
                        }
                      }}
                      className="cursor-pointer border-b border-gray-50 transition-colors last:border-b-0 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                    >
                      <td className="px-5 py-4 text-gray-600">
                        {formatTableDate(lead.last_activity ?? lead.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="block font-medium text-gray-900">{name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{company}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{deriveSourceLabel(lead)}</td>
                      <td className="px-5 py-4 font-mono text-[10px] uppercase tracking-wide text-emerald-700">
                        {formatPipelineStatus(lead)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HighIntentLeadDrawer
        lead={selectedLead}
        clientId={clientId}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </section>
  );
}
