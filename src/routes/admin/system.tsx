import { createFileRoute } from "@tanstack/react-router";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";

export const Route = createFileRoute("/admin/system")({
  head: () => ({
    meta: [
      { title: "Halton/Works — System Health" },
      {
        name: "description",
        content: "Monitor Resend, Notion, and Slack integration status.",
      },
    ],
  }),
  component: AdminSystemHealthPage,
});

function AdminSystemHealthPage() {
  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <div className="eyebrow mb-4">Platform // System Health</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          SYSTEM_HEALTH // MONITOR
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          INTEGRATION_PROBES // NO_SECRETS_EXPOSED
        </p>
      </header>

      <SystemHealthPanel />
    </div>
  );
}
