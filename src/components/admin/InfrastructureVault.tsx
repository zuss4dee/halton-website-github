import { useState } from "react";
import {
  INFRASTRUCTURE_METRICS,
  MASTER_API_PIPES,
  OUTBOUND_DOMAINS,
  type DnsStatus,
} from "@/lib/admin/infrastructureVault";

function DnsStatusCell({ status }: { status: DnsStatus }) {
  if (status === "VERIFIED") {
    return (
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink">VERIFIED</span>
    );
  }

  return (
    <span className="inline-block border border-hairline px-2 py-1 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
      FAILING
    </span>
  );
}

function ApiKeyBlock({
  id,
  label,
  value,
  onChange,
  onUpdate,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border border-hairline p-6 md:p-8">
      <label htmlFor={`api-key-${id}`} className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <input
          id={`api-key-${id}`}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••••••••••"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-none border border-hairline bg-transparent px-4 py-3 font-mono text-[11px] tracking-[0.12em] text-ink placeholder:text-ink-soft/50 focus:border-ink focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={onUpdate}
          className="shrink-0 rounded-none border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          UPDATE
        </button>
      </div>
    </div>
  );
}

export function InfrastructureVault() {
  const [keys, setKeys] = useState<Record<string, string>>(() =>
    Object.fromEntries(MASTER_API_PIPES.map((pipe) => [pipe.id, ""])),
  );

  function handleKeyUpdate(pipeId: string) {
    console.info("[INFR_VAULT] key update requested for", pipeId);
  }

  return (
    <section className="space-y-16 md:space-y-20">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <div className="eyebrow mb-4">Index 001 // Infrastructure Vault</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          INFR_VAULT // 001
        </h1>
      </header>

      {/* Section 01 */}
      <section>
        <h2 className="mb-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-12">
          01 // API_PIPES
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
          {MASTER_API_PIPES.map((pipe) => (
            <ApiKeyBlock
              key={pipe.id}
              id={pipe.id}
              label={pipe.label}
              value={keys[pipe.id] ?? ""}
              onChange={(value) => setKeys((prev) => ({ ...prev, [pipe.id]: value }))}
              onUpdate={() => handleKeyUpdate(pipe.id)}
            />
          ))}
        </div>
      </section>

      {/* Section 02 */}
      <section className="border-t border-hairline pt-16 md:pt-20">
        <h2 className="mb-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-12">
          02 // OUTBOUND_INFRASTRUCTURE
        </h2>

        <div className="border-t border-hairline">
          <div className="hidden md:grid md:grid-cols-12 md:gap-4 border-b border-hairline py-4 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            <div className="col-span-3">Domain Name</div>
            <div className="col-span-3">Workspace Assigned</div>
            <div className="col-span-2">SPF Status</div>
            <div className="col-span-2">DKIM Status</div>
            <div className="col-span-2">DMARC Status</div>
          </div>

          {OUTBOUND_DOMAINS.map((row) => (
            <div
              key={row.domain}
              className="grid grid-cols-1 gap-4 border-b border-hairline py-6 md:grid-cols-12 md:items-baseline md:gap-4 md:py-7"
            >
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden">Domain Name</div>
                <div className="font-display text-lg tracking-[-0.03em] md:text-xl">{row.domain}</div>
              </div>
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden">Workspace Assigned</div>
                <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
                  {row.workspaceAssigned}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="eyebrow mb-1 md:hidden">SPF Status</div>
                <DnsStatusCell status={row.spf} />
              </div>
              <div className="md:col-span-2">
                <div className="eyebrow mb-1 md:hidden">DKIM Status</div>
                <DnsStatusCell status={row.dkim} />
              </div>
              <div className="md:col-span-2">
                <div className="eyebrow mb-1 md:hidden">DMARC Status</div>
                <DnsStatusCell status={row.dmarc} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 03 */}
      <section className="border-t border-hairline pt-10 md:pt-12">
        <div className="grid grid-cols-1 border border-hairline md:grid-cols-2 md:divide-x md:divide-hairline">
          <div className="border-b border-hairline px-6 py-10 md:border-b-0 md:px-10 md:py-12">
            <p className="font-display text-[clamp(1.75rem,6vw,3.5rem)] leading-[0.95] tracking-[-0.035em] text-balance">
              TOTAL_ACTIVE_INBOXES //{" "}
              {String(INFRASTRUCTURE_METRICS.totalActiveInboxes).padStart(2, "0")}
            </p>
          </div>
          <div className="px-6 py-10 md:px-10 md:py-12">
            <p className="font-display text-[clamp(1.75rem,6vw,3.5rem)] leading-[0.95] tracking-[-0.035em] text-balance">
              DAILY_POOL_CAPACITY // {INFRASTRUCTURE_METRICS.dailyPoolCapacity}_EMAILS
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
