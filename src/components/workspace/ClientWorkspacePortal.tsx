import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { OrgChart } from "@/components/workspace/OrgChart";
import { supabase } from "@/lib/supabase";
import {
  fetchClientWorkspaceData,
  type ClientWorkspacePayload,
  type LiveLeadSignalRow,
} from "@/lib/workspace/clientWorkspaceData";
import { useOrgChart } from "@/lib/workspace/useOrgChart";

type ClientWorkspacePortalProps = {
  clientId: string;
};

function formatReplyDate(value: string | null | undefined): string {
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

type MassiveKpiProps = {
  label: string;
  value: string;
  isLoading: boolean;
};

function MassiveKpi({ label, value, isLoading }: MassiveKpiProps) {
  return (
    <div className="flex min-h-[180px] flex-col justify-between py-2 md:min-h-[220px]">
      <p className="font-mono text-[11px] tracking-[0.28em] text-ink/50 uppercase">
        {label}
      </p>
      <p className="font-display text-[clamp(3rem,12vw,6.5rem)] leading-[0.85] tracking-[-0.05em] text-ink tabular-nums">
        {isLoading ? "—" : value}
      </p>
    </div>
  );
}

function LatestReplyRow({ lead }: { lead: LiveLeadSignalRow }) {
  const name = lead.prospect_name?.trim() || "Unknown";
  const company =
    lead.target_company?.trim() || lead.company_name?.trim() || "—";
  const repliedAt = formatReplyDate(lead.last_activity ?? lead.created_at);

  return (
    <tr className="group">
      <td className="py-5 pr-8 font-mono text-sm tracking-[0.06em] text-ink uppercase">
        {name}
      </td>
      <td className="py-5 pr-8 font-mono text-sm tracking-[0.04em] text-ink/70 uppercase">
        {company}
      </td>
      <td className="py-5 text-right font-mono text-sm tracking-[0.08em] text-ink/60 tabular-nums">
        {repliedAt}
      </td>
    </tr>
  );
}

const signOutClassName =
  "font-mono text-[10px] tracking-[0.2em] text-ink/50 uppercase transition-colors hover:text-ink";

export function ClientWorkspacePortal({ clientId }: ClientWorkspacePortalProps) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ClientWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const {
    tree: orgTree,
    isLoading: isOrgChartLoading,
    error: orgChartError,
  } = useOrgChart(clientId);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
    setIsSigningOut(false);
  }

  const load = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchClientWorkspaceData(clientId);
    setPayload(data);
    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const client = payload?.client;
  const metrics = payload?.metrics;
  const replies = payload?.signals ?? [];
  const error = payload?.error;
  const companyName = client?.company_name?.trim() ?? "YOUR COMPANY";

  const totalOutreach = metrics ? metrics.emailsSent.toLocaleString() : "—";
  const engagementRate = metrics?.openRatePercent ?? "—";
  const readyToClose = metrics ? metrics.totalReplies.toLocaleString() : "—";

  return (
    <main className="min-h-screen bg-paper text-ink selection:bg-ink selection:text-paper">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <header className="mb-16 flex flex-col gap-8 md:mb-20 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-display text-[clamp(1.75rem,5vw,3.25rem)] leading-[0.92] tracking-[-0.04em] uppercase">
                {isLoading ? "Loading…" : companyName}
              </h1>
              <span className="font-mono text-[11px] tracking-[0.22em] text-ink/40 uppercase">
                //
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-ink uppercase">
                <span
                  className="relative flex h-2.5 w-2.5"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Live Signal
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className={`${signOutClassName} self-start disabled:opacity-40`}
          >
            {isSigningOut ? "[ Signing Out… ]" : "[ Sign Out ]"}
          </button>
        </header>

        {error ? (
          <p className="mb-12 font-mono text-[11px] tracking-[0.14em] text-ink/60 uppercase">
            {error}
          </p>
        ) : null}

        <section className="mb-20 grid grid-cols-1 gap-12 md:mb-28 md:grid-cols-3 md:gap-8">
          <MassiveKpi
            label="Total Outreach"
            value={totalOutreach}
            isLoading={isLoading}
          />
          <MassiveKpi
            label="Engagement Rate"
            value={engagementRate}
            isLoading={isLoading}
          />
          <MassiveKpi
            label="Ready to Close (Replies)"
            value={readyToClose}
            isLoading={isLoading}
          />
        </section>

        <section className="mb-20 md:mb-28">
          <OrgChart
            tree={orgTree}
            isLoading={isOrgChartLoading}
            error={orgChartError}
          />
        </section>

        <section>
          <h2 className="mb-10 font-mono text-[11px] tracking-[0.3em] text-ink/45 uppercase">
            Latest Replies
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="font-mono text-[10px] tracking-[0.24em] text-ink/35 uppercase">
                  <th className="pb-4 pr-8 font-normal">Name</th>
                  <th className="pb-4 pr-8 font-normal">Company</th>
                  <th className="pb-4 text-right font-normal">Date Replied</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-12 font-mono text-[11px] tracking-[0.2em] text-ink/40 uppercase"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : replies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-12 font-mono text-[11px] tracking-[0.2em] text-ink/40 uppercase"
                    >
                      No replies yet
                    </td>
                  </tr>
                ) : (
                  replies.map((lead) => (
                    <LatestReplyRow key={lead.id} lead={lead} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
