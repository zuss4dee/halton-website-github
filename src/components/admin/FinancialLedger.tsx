import {
  computeNetMarginGbp,
  computeTotalMrr,
  formatGbp,
  workspaceRegistry,
  type RetainerStatus,
} from "@/lib/admin/workspaceRegistry";

const retainerTone: Record<RetainerStatus, string> = {
  Active: "text-ink",
  Unpaid: "text-ink-soft",
};

export function FinancialLedger() {
  const totalMrr = computeTotalMrr();

  return (
    <section>
      <header className="mb-12 md:mb-16 border-b border-hairline pb-8">
        <div className="eyebrow mb-4">Index 002 — Ledger</div>
        <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[0.9] tracking-[-0.04em] text-balance">
          Financial Ledger
        </h1>
        <p className="mt-6 max-w-2xl text-base text-ink-soft leading-relaxed">
          Retainer revenue, estimated API spend, and net margin across every workspace in the fleet
          registry.
        </p>
      </header>

      <div className="mb-16 md:mb-20 border-b border-hairline pb-12 md:pb-16">
        <div className="eyebrow mb-6">— Recurring Revenue</div>
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft mb-5 max-w-2xl">
          Total Monthly Recurring Revenue (MRR)
        </p>
        <div
          className="font-display text-[clamp(3rem,14vw,10rem)] leading-[0.86] tracking-[-0.05em] text-balance"
          aria-label={`Total MRR ${formatGbp(totalMrr)}`}
        >
          {formatGbp(totalMrr)}
        </div>
        <p className="mt-6 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
          {workspaceRegistry.filter((row) => row.retainerStatus === "Active").length} active
          retainers · £1,500 / client
        </p>
      </div>

      <div className="border-t border-hairline">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-3">— Margin Register</div>
            <h2 className="font-display text-3xl md:text-4xl tracking-[-0.035em] leading-[0.95]">
              Client Economics
            </h2>
          </div>
          <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
            {workspaceRegistry.length} clients · ledger
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-12 gap-4 py-4 border-b border-hairline font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
          <div className="col-span-4">Client Company</div>
          <div className="col-span-2">Retainer Status</div>
          <div className="col-span-3">Estimated API Cost</div>
          <div className="col-span-3">Net Margin</div>
        </div>

        {workspaceRegistry.map((row) => {
          const netMargin = computeNetMarginGbp(row);

          return (
            <div
              key={row.company}
              className="grid grid-cols-1 gap-3 border-b border-hairline py-6 md:grid-cols-12 md:items-baseline md:gap-4 md:py-7"
            >
              <div className="md:col-span-4">
                <div className="eyebrow mb-1 md:hidden">Client Company</div>
                <div className="font-display text-xl md:text-2xl tracking-[-0.03em]">
                  {row.company}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="eyebrow mb-1 md:hidden">Retainer Status</div>
                <div
                  className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase ${retainerTone[row.retainerStatus]}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {row.retainerStatus}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden">Estimated API Cost</div>
                <div className="font-mono text-[11px] tracking-[0.16em] uppercase">
                  {formatGbp(row.estimatedApiCostGbp)}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden">Net Margin</div>
                <div className="font-mono text-[11px] tracking-[0.16em] uppercase">
                  {netMargin === null ? "—" : formatGbp(netMargin)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
