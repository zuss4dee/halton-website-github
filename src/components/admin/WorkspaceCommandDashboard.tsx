import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type WorkspaceCommandDashboardProps = {
  clientId: string;
};

type DashboardMetrics = {
  totalLeads: number;
  pendingReview: number;
  sentEmails: number;
  totalAgentOps: number;
  isLoading: boolean;
};

const INITIAL_METRICS: DashboardMetrics = {
  totalLeads: 0,
  pendingReview: 0,
  sentEmails: 0,
  totalAgentOps: 0,
  isLoading: true,
};

type MetricCardProps = {
  descriptor: string;
  value: number;
  isLoading: boolean;
  caption: string;
};

function MetricCard({ descriptor, value, isLoading, caption }: MetricCardProps) {
  return (
    <article className="rounded-none border border-gray-800 bg-[#0a0a0a] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <header className="border-b border-gray-800 pb-3">
        <p className="font-mono text-[10px] leading-relaxed tracking-[0.14em] text-gray-500">
          {descriptor}
        </p>
      </header>
      <p className="mt-4 font-mono text-3xl leading-none tabular-nums tracking-tight sm:text-4xl">
        {isLoading ? (
          <span className="text-gray-500">[ CALC... ]</span>
        ) : (
          <span className="text-emerald-400">{value.toLocaleString()}</span>
        )}
      </p>
      <span className="mt-2 block text-xs text-gray-500">{caption}</span>
    </article>
  );
}

export function WorkspaceCommandDashboard({ clientId }: WorkspaceCommandDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);

  const fetchMetrics = useCallback(async () => {
    setMetrics((prev) => ({ ...prev, isLoading: true }));

    const [leads, pending, sent, agentOps] = await Promise.all([
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
        .from("agent_logs")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

    if (leads.error) console.error("DASHBOARD leads count:", leads.error);
    if (pending.error) console.error("DASHBOARD pending count:", pending.error);
    if (sent.error) console.error("DASHBOARD sent count:", sent.error);
    if (agentOps.error) console.error("DASHBOARD agent_logs count:", agentOps.error);

    setMetrics({
      totalLeads: leads.count ?? 0,
      pendingReview: pending.count ?? 0,
      sentEmails: sent.count ?? 0,
      totalAgentOps: agentOps.count ?? 0,
      isLoading: false,
    });
  }, [clientId]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  return (
    <section className="min-h-[60vh] bg-black font-mono text-gray-300">
      <header className="border-b border-gray-800 pb-6">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-4 inline-block text-[11px] tracking-[0.16em] uppercase text-gray-500 transition-colors hover:text-gray-300"
        >
          &gt; ORCHESTRATION_DECK
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-sm tracking-[0.2em] uppercase text-gray-300">
            [ COMMAND_DASHBOARD ] - LIVE TELEMETRY
          </h1>
          <button
            type="button"
            disabled={metrics.isLoading}
            onClick={() => void fetchMetrics()}
            className="border border-gray-700 px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-40"
          >
            {metrics.isLoading ? "[ SYNC... ]" : "[ REFRESH ]"}
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-px rounded-none border border-gray-800 bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          descriptor="// INGESTED_SIGNALS"
          value={metrics.totalLeads}
          isLoading={metrics.isLoading}
          caption="Total raw leads scraped/captured"
        />
        <MetricCard
          descriptor="// PENDING_TRIAGE"
          value={metrics.pendingReview}
          isLoading={metrics.isLoading}
          caption="Leads awaiting your approval"
        />
        <MetricCard
          descriptor="// ACTIVE_OUTBOUND"
          value={metrics.sentEmails}
          isLoading={metrics.isLoading}
          caption="Prospects currently in sequences"
        />
        <MetricCard
          descriptor="// POSITIVE_INTENT"
          value={metrics.totalAgentOps}
          isLoading={metrics.isLoading}
          caption="Replies or booked meetings"
        />
      </div>
    </section>
  );
}
