import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AttentionDot } from "@/components/admin/AttentionDot";
import { GLOBAL_NAV, workspacePath, type WorkspaceNavSegment } from "@/lib/admin/adminNav";
import { useWorkspaceAttention } from "@/lib/admin/useWorkspaceAttention";
import { ViewOrgChartButton } from "@/components/workspace/ViewOrgChartButton";
import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORKSPACE_SIDEBAR_LINKS: {
  label: string;
  segment: Exclude<WorkspaceNavSegment, "global" | "dashboard">;
  attention?: "pendingDrafts";
}[] = [
  { label: "04 // ACTIVE PIPELINE", segment: "outbound", attention: "pendingDrafts" },
  { label: "02 // CLIENT ASSETS", segment: "vault" },
  { label: "03 // CAMPAIGN RULES", segment: "workflow" },
  { label: "03a // AUTOMATED_SEQUENCE", segment: "sequence" },
  { label: "03b // COPY_LIBRARY", segment: "templates" },
  { label: "05 // WORKSPACE SETTINGS", segment: "settings" },
  { label: "06 // CREDENTIALS", segment: "credentials" },
];

function isClientWorkspaceHome(pathname: string, clientId: string) {
  const home = `/admin/client/${clientId}`;
  return pathname === home || pathname === `${home}/`;
}

function isAgentsPath(pathname: string, clientId: string) {
  const prefix = `/admin/client/${clientId}`;
  return (
    pathname === `${prefix}/orchestration` ||
    pathname.startsWith(`${prefix}/orchestration/`) ||
    pathname.startsWith(`${prefix}/agents/`)
  );
}

function SidebarNavRow({
  to,
  params,
  search,
  label,
  isActive,
  attention = false,
  attentionLabel,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | boolean>;
  label: string;
  isActive: boolean;
  attention?: boolean;
  attentionLabel?: string;
}) {
  return (
    <Link
      to={to}
      params={params}
      search={search}
      aria-label={attention ? attentionLabel ?? `${label} — needs attention` : undefined}
      className={`block px-3 py-2.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
        isActive
          ? "bg-ink text-paper"
          : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {attention ? <AttentionDot /> : null}
        <span>{label}</span>
      </span>
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWorkspace = pathname.includes("/admin/client/");
  const clientId = isWorkspace
    ? (pathname.split("/admin/client/")[1]?.split("/")[0] ?? null)
    : null;
  const [clientName, setClientName] = useState<string | null>(null);
  const { hasPendingDrafts, pendingDraftCount } = useWorkspaceAttention(clientId ?? undefined);

  useEffect(() => {
    if (!clientId) {
      setClientName(null);
      return;
    }

    let cancelled = false;

    const fetchClientName = async () => {
      const isUuid = UUID_PATTERN.test(clientId);
      const query = supabase.from("clients").select("company_name");

      const { data, error } = isUuid
        ? await query.eq("id", clientId).single()
        : await query.eq("slug", clientId).single();

      if (cancelled) return;
      if (error) {
        setClientName(null);
        return;
      }

      setClientName((data?.company_name as string | null | undefined)?.trim() || null);
    };

    void fetchClientName();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-hairline bg-paper md:w-[240px] md:min-w-[240px] md:border-b-0 md:border-r">
      <div className="border-b border-hairline px-4 py-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-ink-soft uppercase">
          Halton / Works
        </div>
        <div className="mt-1 font-display text-lg leading-none tracking-[-0.03em] text-ink">
          Command Center
        </div>
      </div>

      <div className="border-b border-hairline px-3 py-3">
        <Link
          to="/admin"
          search={{ onboard: true }}
          className="block w-full border border-ink bg-ink px-3 py-2.5 text-center font-mono text-[10px] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-90"
        >
          + Onboard Client
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
        {isWorkspace && clientId ? (
          <>
            <p className="px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-ink/40 uppercase">
              WORKSPACE // {clientName ?? clientId.slice(0, 8)}
            </p>
            <Link
              to="/admin"
              className="mx-3 mb-2 block font-mono text-[9px] tracking-[0.16em] text-ink-soft uppercase hover:text-ink"
            >
              ← ALL CLIENTS
            </Link>
            <SidebarNavRow
              to="/admin/client/$id"
              params={{ id: clientId }}
              label="01 // Analytics"
              isActive={isClientWorkspaceHome(pathname, clientId)}
            />
            <SidebarNavRow
              to="/admin/client/$id/orchestration"
              params={{ id: clientId }}
              label="02 // Agents"
              isActive={isAgentsPath(pathname, clientId)}
            />
            {WORKSPACE_SIDEBAR_LINKS.map((item) => {
              const href = workspacePath(clientId, item.segment);
              const isActive =
                pathname === href || pathname.startsWith(`${href}/`);
              const needsAttention =
                item.attention === "pendingDrafts" && hasPendingDrafts;

              return (
                <SidebarNavRow
                  key={item.segment}
                  to={href}
                  label={item.label}
                  isActive={isActive}
                  attention={needsAttention}
                  attentionLabel={
                    needsAttention
                      ? `${item.label} — ${pendingDraftCount} draft${pendingDraftCount === 1 ? "" : "s"} pending approval`
                      : undefined
                  }
                />
              );
            })}
            <ViewOrgChartButton
              clientId={clientId}
              variant="sidebar"
              label="07 // ORG CHART"
            />
          </>
        ) : (
          GLOBAL_NAV.map((item) => {
            const isActive =
              item.to === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);

            return (
              <SidebarNavRow
                key={item.label}
                to={item.to}
                label={item.label}
                isActive={isActive}
              />
            );
          })
        )}
      </nav>
    </aside>
  );
}
