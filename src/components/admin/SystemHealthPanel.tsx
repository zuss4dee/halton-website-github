import { useCallback, useEffect, useState } from "react";
import type { HealthCheckResult, SystemHealthReport } from "@/lib/health-check";

type IntegrationKey = "resend" | "notion" | "slack";

type RowState = "checking" | HealthCheckResult["status"];

const INTEGRATIONS: Array<{
  key: IntegrationKey;
  label: string;
  description: string;
}> = [
  {
    key: "resend",
    label: "Resend",
    description: "Outbound email delivery API",
  },
  {
    key: "notion",
    label: "Notion",
    description: "CRM database sync",
  },
  {
    key: "slack",
    label: "Slack",
    description: "Incoming webhook notifications",
  },
];

function StatusBadge({ state, detail }: { state: RowState; detail?: string }) {
  if (state === "checking") {
    return (
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft animate-pulse">
        [ Checking... ]
      </span>
    );
  }

  if (state === "connected") {
    return (
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-600">
        [ Connected ]
      </span>
    );
  }

  if (state === "ready") {
    return (
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-600">
        [ Ready ]
      </span>
    );
  }

  return (
    <span
      className="font-mono text-[10px] tracking-[0.14em] uppercase text-red-600"
      title={detail}
    >
      [ Failed ]
    </span>
  );
}

export function SystemHealthPanel() {
  const [rows, setRows] = useState<Record<IntegrationKey, RowState>>({
    resend: "checking",
    notion: "checking",
    slack: "checking",
  });
  const [details, setDetails] = useState<Partial<Record<IntegrationKey, string>>>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyReport = useCallback((report: SystemHealthReport) => {
    setRows({
      resend: report.resend.status,
      notion: report.notion.status,
      slack: report.slack.status,
    });
    setDetails({
      resend: report.resend.detail,
      notion: report.notion.detail,
      slack: report.slack.detail,
    });
    setCheckedAt(report.checkedAt);
  }, []);

  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    setRows({ resend: "checking", notion: "checking", slack: "checking" });

    try {
      const response = await fetch("/api/health");
      const payload = (await response.json()) as SystemHealthReport | { error?: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "Health check request failed",
        );
      }

      applyReport(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Health check failed";
      setErrorMessage(message);
      setRows({ resend: "failed", notion: "failed", slack: "failed" });
    } finally {
      setIsRefreshing(false);
    }
  }, [applyReport]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-3">
        <div>
          <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            Integration Status
          </h2>
          {checkedAt ? (
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft/80">
              Last checked {new Date(checkedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={isRefreshing}
          onClick={() => void runChecks()}
          className="border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
        >
          {isRefreshing ? "Checking…" : "Re-run Checks"}
        </button>
      </div>

      {errorMessage ? (
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <div className="border border-hairline">
        <div className="hidden grid-cols-12 gap-2 border-b border-hairline px-4 py-2 font-mono text-[9px] tracking-[0.16em] uppercase text-ink-soft md:grid">
          <div className="col-span-3">Integration</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-6">Detail</div>
        </div>

        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.key}
            className="grid grid-cols-1 gap-2 border-b border-hairline px-4 py-4 last:border-b-0 md:grid-cols-12 md:items-center"
          >
            <div className="md:col-span-3">
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink">
                {integration.label}
              </p>
              <p className="mt-1 font-mono text-[9px] text-ink-soft">{integration.description}</p>
            </div>
            <div className="md:col-span-3">
              <StatusBadge state={rows[integration.key]} detail={details[integration.key]} />
            </div>
            <div className="md:col-span-6 font-mono text-[10px] leading-relaxed text-ink-soft">
              {rows[integration.key] === "checking"
                ? "Running server-side probe…"
                : details[integration.key] ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft/80">
        Checks run server-side. No secret values are returned to the browser.
      </p>
    </section>
  );
}
