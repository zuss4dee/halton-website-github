import { Link } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { workspacePath } from "@/lib/admin/adminNav";

const MODULE_LINKS: {
  code: string;
  label: string;
  segment: "workflow" | "outbound" | "templates" | "vault" | "settings" | "credentials" | "orchestration";
}[] = [
  { code: "01", label: "Campaign Rules", segment: "workflow" },
  { code: "02", label: "Active Pipeline", segment: "outbound" },
  { code: "03", label: "Email Templates", segment: "templates" },
  { code: "04", label: "Client Assets", segment: "vault" },
  { code: "05", label: "Agent Orchestration", segment: "orchestration" },
  { code: "06", label: "Workspace Settings", segment: "settings" },
  { code: "07", label: "Credentials", segment: "credentials" },
];

const actionLinkClassName =
  "border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper";

export function ClientManageCampaignsHub() {
  const client = useClientRoute();
  const clientId = client.id;

  if (!clientId) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  const companyName = client.company_name?.trim() ?? "UNKNOWN_CLIENT";

  return (
    <div className="-mx-2 rounded-lg border border-hairline bg-paper text-ink selection:bg-ink selection:text-paper md:-mx-0">
      <div className="border-b border-hairline px-6 py-8 md:px-8">
        <div className="eyebrow mb-3">Admin // Manage Campaigns</div>
        <h1 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.9] tracking-[-0.04em]">
          {companyName}
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          TENANT_ID // {clientId}
          {client.sending_domain ? ` · DOMAIN // ${client.sending_domain}` : ""}
        </p>
        <p className="mt-6 max-w-2xl font-mono text-[11px] leading-relaxed text-ink-soft">
          INTERNAL_OPS_TERMINAL — Select a module to configure outbound, pipeline, and
          assets for this client. Client-facing view is read-only at the workspace URL.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/admin" className={actionLinkClassName}>
            [← Command Center]
          </Link>
          <a href={`/workspace/${clientId}`} className={actionLinkClassName}>
            [ View As Client ]
          </a>
          <Link
            to="/admin/client/$id/dashboard"
            params={{ id: clientId }}
            className={actionLinkClassName}
          >
            [ Analytics ]
          </Link>
        </div>
      </div>

      <section className="px-6 py-8 md:px-8">
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
          00 // CAMPAIGN_MODULES
        </h2>
        <ul className="divide-y divide-hairline border border-hairline">
          {MODULE_LINKS.map((module) => (
            <li key={module.segment}>
              <Link
                to={workspacePath(clientId, module.segment)}
                className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-ink/[0.03] md:flex-row md:items-center md:justify-between"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                  {module.code} //
                </span>
                <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink">
                  {module.label}
                </span>
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink">
                  [ ENTER → ]
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
          PLACEHOLDER_HUB — Additional campaign tooling will mount here.
        </p>
      </section>
    </div>
  );
}
