import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import {
  fetchClientWorkspaceData,
  type ClientWorkspacePayload,
  type LiveLeadSignalRow,
} from "@/lib/workspace/clientWorkspaceData";

type ClientWorkspacePortalProps = {
  clientId: string;
};

function formatSignalDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

type KpiCardProps = {
  label: string;
  value: string;
  caption: string;
  isLoading: boolean;
};

function KpiCard({ label, value, caption, isLoading }: KpiCardProps) {
  return (
    <article className="border border-hairline bg-paper px-5 py-5">
      <header className="border-b border-hairline pb-3">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
          {label}
        </p>
      </header>
      <p className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-0.04em] text-ink">
        {isLoading ? (
          <span className="text-ink-soft">—</span>
        ) : (
          <span className="tabular-nums">{value}</span>
        )}
      </p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
        {caption}
      </p>
    </article>
  );
}

function SignalRow({ lead }: { lead: LiveLeadSignalRow }) {
  const name = lead.prospect_name?.trim() || "UNKNOWN_PROSPECT";
  const company = lead.target_company?.trim() || lead.company_name?.trim() || "—";
  const role = lead.target_role?.trim() || lead.role?.trim() || "—";
  const email = lead.email?.trim() || "—";

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-hairline px-4 py-5 last:border-b-0 md:grid-cols-12 md:items-start md:gap-4 md:py-4">
      <div className="md:col-span-3">
        <div className="eyebrow mb-1 md:hidden">Prospect</div>
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink">{name}</div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-ink-soft">{email}</div>
      </div>
      <div className="md:col-span-2">
        <div className="eyebrow mb-1 md:hidden">Company</div>
        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-soft">
          {company}
        </div>
        <div className="mt-1 font-mono text-[10px] text-ink-soft">{role}</div>
      </div>
      <div className="md:col-span-2">
        <div className="eyebrow mb-1 md:hidden">Signal Time</div>
        <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink">
          {formatSignalDate(lead.last_activity ?? lead.created_at)}
        </div>
      </div>
      <div className="md:col-span-5">
        <div className="eyebrow mb-1 md:hidden">Inbound Reply</div>
        {lead.replySubject ? (
          <div className="mb-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
            SUBJ // {lead.replySubject}
          </div>
        ) : null}
        <blockquote className="border-l-2 border-ink pl-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {lead.replyPreview || "NO_REPLY_TEXT_CAPTURED"}
        </blockquote>
      </div>
    </div>
  );
}

export function ClientWorkspacePortal({ clientId }: ClientWorkspacePortalProps) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ClientWorkspacePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
  const signals = payload?.signals ?? [];
  const error = payload?.error;

  return (
    <main className="min-h-screen bg-paper text-ink selection:bg-ink selection:text-paper">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10 md:py-14">
        <header className="border-b border-hairline pb-8">
          <div className="eyebrow mb-3">Workspace // Client Terminal</div>
          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.9] tracking-[-0.04em]">
            {isLoading
              ? "LOADING_WORKSPACE…"
              : (client?.company_name?.trim() ?? "UNKNOWN_CLIENT")}
          </h1>
          <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
            TENANT_ID // {client?.id ?? clientId}
            {client?.sending_domain ? ` · DOMAIN // ${client.sending_domain}` : ""}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {isSigningOut ? "[ Signing Out… ]" : "[ Sign Out ]"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mt-8 font-mono text-[11px] tracking-[0.14em] uppercase text-red-700">
            ERROR // {error}
          </p>
        ) : null}

        <section className="mt-10">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            00 // KPI_TELEMETRY
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="[ Emails Sent ]"
              value={metrics ? metrics.emailsSent.toLocaleString() : "—"}
              caption="QUEUE_STATUS // SENT"
              isLoading={isLoading}
            />
            <KpiCard
              label="[ Open Rate ]"
              value={metrics?.openRatePercent ?? "—"}
              caption={metrics?.openRateCaption ?? "—"}
              isLoading={isLoading}
            />
            <KpiCard
              label="[ Total Replies ]"
              value={metrics ? metrics.totalReplies.toLocaleString() : "—"}
              caption="STATUS // REPLIED"
              isLoading={isLoading}
            />
          </div>
        </section>

        <section className="mt-12 border-t border-hairline pt-10">
          <h2 className="mb-2 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            01 // LIVE_LEAD_SIGNAL
          </h2>
          <p className="mb-6 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
            PROSPECTS_WHO_REPLIED_TO_THIS_CLIENT_CAMPAIGN
          </p>

          <div className="border border-hairline">
            <div className="hidden border-b border-hairline px-4 py-3 md:grid md:grid-cols-12 md:gap-4">
              <div className="col-span-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Prospect
              </div>
              <div className="col-span-2 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Company
              </div>
              <div className="col-span-2 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Signal Time
              </div>
              <div className="col-span-5 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Inbound Reply
              </div>
            </div>

            {isLoading ? (
              <div className="px-4 py-10 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                SCANNING_INBOUND_SIGNALS…
              </div>
            ) : signals.length === 0 ? (
              <div className="px-4 py-10 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                NO_LIVE_SIGNALS // AWAITING_REPLIES
              </div>
            ) : (
              signals.map((lead) => <SignalRow key={lead.id} lead={lead} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
