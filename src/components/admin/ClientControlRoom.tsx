import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import type { ApiConnectionStatus } from "@/lib/admin-workspaces";

type ClientControlRoomProps = {
  client: ClientRow;
};

function connectionLabel(status: ApiConnectionStatus) {
  return status;
}

export function ClientControlRoom({ client }: ClientControlRoomProps) {
  const [systemActive, setSystemActive] = useState(true);

  const companyName = client.company_name?.trim() ?? "Unknown Client";
  const monthlyRetainer = client.monthly_retainer ?? 0;
  const activeAgents = client.active_agents ?? 0;
  const meetingsBooked = client.meetings_booked ?? 0;

  const metrics = [
    {
      label: "NET_MEETINGS_SECURED",
      value: String(meetingsBooked).padStart(2, "0"),
    },
    {
      label: "MONTHLY_RETAINER",
      value: `£${monthlyRetainer.toLocaleString("en-GB")}`,
    },
    {
      label: "ACTIVE_AGENTS",
      value: String(activeAgents).padStart(2, "0"),
    },
  ];

  const domains: { domain: string; instantly: ApiConnectionStatus; apollo: ApiConnectionStatus }[] =
    [];
  const pipelineActivity: {
    date: string;
    prospectName: string;
    targetCompany: string;
    action: string;
  }[] = [];

  return (
    <section className="space-y-14 md:space-y-20">
      {/* Section 01 */}
      <header>
        <Link
          to="/admin"
          className="mb-8 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          &lt; RETURN_TO_GLOBAL_COMMAND
        </Link>

        <div className="flex flex-col gap-6 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between md:pb-10">
          <h1 className="font-display text-[clamp(2.75rem,11vw,7.5rem)] font-medium leading-[0.86] tracking-[-0.05em]">
            {companyName.toUpperCase()}
          </h1>
          <span className="inline-flex w-fit shrink-0 rounded-none border border-ink bg-ink px-4 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-paper">
            RETAINER_ACTIVE
          </span>
        </div>
      </header>

      {/* Section 02 */}
      <section>
        <div className="grid grid-cols-1 border border-hairline md:grid-cols-3">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`px-6 py-8 md:px-8 md:py-10 ${
                index < metrics.length - 1
                  ? "border-b border-hairline md:border-b-0 md:border-r md:border-hairline"
                  : ""
              }`}
            >
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
                {metric.label} //
              </div>
              <div className="mt-4 font-display text-[clamp(2.5rem,8vw,5rem)] leading-none tracking-[-0.04em]">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 03 */}
      <section className="border-t border-hairline pt-14 md:pt-16">
        <h2 className="mb-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-10">
          02 // OUTBOUND_ENGINE_STATUS
        </h2>

        <button
          type="button"
          onClick={() => setSystemActive((active) => !active)}
          className={`mb-8 w-full rounded-none border px-6 py-6 font-mono text-[12px] tracking-[0.14em] uppercase transition-colors md:py-8 md:text-[13px] ${
            systemActive
              ? "border-ink bg-white text-black hover:opacity-90"
              : "border-hairline bg-ink text-paper hover:opacity-90"
          }`}
        >
          {systemActive
            ? "SYSTEM_ACTIVE // PAUSE_ALL_OPERATIONS"
            : "SYSTEM_PAUSED // RESUME_ALL_OPERATIONS"}
        </button>

        <ul className="space-y-0 border border-hairline">
          {domains.length === 0 ? (
            <li className="px-5 py-5 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft md:px-6">
              NO_DOMAIN_RECORDS
            </li>
          ) : (
            domains.map((entry) => (
              <li
                key={entry.domain}
                className="flex flex-col gap-3 border-b border-hairline px-5 py-5 last:border-b-0 md:flex-row md:items-baseline md:justify-between md:px-6"
              >
                <span className="font-display text-lg tracking-[-0.03em] md:text-xl">
                  {entry.domain}
                </span>
                <div className="flex flex-wrap gap-6 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
                  <span>
                    Instantly:{" "}
                    <span className={entry.instantly === "CONNECTED" ? "text-ink" : "text-ink-soft"}>
                      {connectionLabel(entry.instantly)}
                    </span>
                  </span>
                  <span>
                    Apollo:{" "}
                    <span className={entry.apollo === "CONNECTED" ? "text-ink" : "text-ink-soft"}>
                      {connectionLabel(entry.apollo)}
                    </span>
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Section 04 */}
      <section className="border-t border-hairline pt-14 md:pt-16">
        <h2 className="mb-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-12">
          03 // RECENT_PIPELINE_ACTIVITY
        </h2>

        <div className="border-t border-hairline">
          <div className="hidden md:grid md:grid-cols-12 md:gap-4 border-b border-hairline py-4 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Prospect Name</div>
            <div className="col-span-4">Target Company</div>
            <div className="col-span-3">Action</div>
          </div>

          {pipelineActivity.length === 0 ? (
            <div className="border-b border-hairline py-6 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft md:py-7">
              NO_PIPELINE_ACTIVITY
            </div>
          ) : (
            pipelineActivity.map((row) => (
              <div
                key={`${row.date}-${row.prospectName}-${row.action}`}
                className="grid grid-cols-1 gap-3 border-b border-hairline py-6 md:grid-cols-12 md:items-baseline md:gap-4 md:py-7"
              >
                <div className="md:col-span-2">
                  <div className="eyebrow mb-1 md:hidden">Date</div>
                  <div className="font-mono text-[11px] tracking-[0.14em] uppercase">{row.date}</div>
                </div>
                <div className="md:col-span-3">
                  <div className="eyebrow mb-1 md:hidden">Prospect Name</div>
                  <div className="font-display text-lg tracking-[-0.03em]">{row.prospectName}</div>
                </div>
                <div className="md:col-span-4">
                  <div className="eyebrow mb-1 md:hidden">Target Company</div>
                  <div className="font-mono text-[11px] tracking-[0.12em] uppercase">
                    {row.targetCompany}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="eyebrow mb-1 md:hidden">Action</div>
                  <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink">
                    {row.action}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
