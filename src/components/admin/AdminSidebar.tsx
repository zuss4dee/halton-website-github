import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, FileText, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { GLOBAL_NAV, workspacePath, type WorkspaceNavSegment } from "@/lib/admin/adminNav";
import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORKSPACE_SIDEBAR_LINKS: {
  label: string;
  segment: Exclude<WorkspaceNavSegment, "global" | "dashboard">;
  icon?: LucideIcon;
}[] = [
  { label: "Active Pipeline", segment: "outbound" },
  { label: "Client Assets", segment: "vault" },
  { label: "Campaign Rules", segment: "workflow" },
  { label: "Templates", segment: "templates", icon: FileText },
  { label: "Settings", segment: "settings" },
  { label: "Credentials", segment: "credentials" },
];

function isDashboardPath(pathname: string, clientId: string) {
  const dashboardPath = `/admin/client/${clientId}`;
  return pathname === dashboardPath || pathname === `${dashboardPath}/`;
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
  label,
  isActive,
  badge,
  icon,
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  isActive: boolean;
  badge?: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        isActive
          ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
          : "text-gray-600 hover:bg-white/80 hover:text-gray-900"
      }`}
    >
      <span className="shrink-0 text-gray-400 group-hover:text-gray-600" aria-hidden>
        {icon ?? "›"}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-700">
          {badge}
        </span>
      ) : null}
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

      const name = (data?.company_name as string | null | undefined)?.trim();
      setClientName(name || null);
    };

    void fetchClientName();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const workspaceSectionLabel = clientName ?? "Workspace";

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-gray-50 md:w-[260px] md:min-w-[260px] md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          className="shrink-0 text-gray-900"
          aria-hidden
        >
          <rect x="0.5" y="0.5" width="21" height="21" stroke="currentColor" />
          <rect x="5" y="5" width="12" height="12" fill="currentColor" />
        </svg>
        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] tracking-[0.18em] text-gray-900">
            Halton&nbsp;/&nbsp;Works
          </div>
          <div className="truncate font-mono text-[10px] tracking-[0.14em] text-gray-500">
            Command Center
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          disabled
          className="w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors disabled:cursor-default disabled:opacity-80"
        >
          + Onboard Client
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4 pt-1">
        {isWorkspace && clientId ? (
          <>
            <p
              className={`truncate px-3 pb-1 pt-1 font-mono text-[10px] tracking-[0.18em] text-gray-400 ${
                clientName ? "normal-case" : "uppercase"
              }`}
              title={workspaceSectionLabel}
            >
              {workspaceSectionLabel}
            </p>
            <Link
              to="/admin"
              className="mx-1 mb-0.5 block rounded-lg px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-600"
            >
              ← Return to Global
            </Link>
            <SidebarNavRow
              to="/admin/client/$id"
              params={{ id: clientId }}
              label="Analytics"
              isActive={isDashboardPath(pathname, clientId)}
              badge="LIVE"
            />
            <SidebarNavRow
              to="/admin/client/$id/orchestration"
              params={{ id: clientId }}
              label="Agents"
              isActive={isAgentsPath(pathname, clientId)}
              icon={<Bot className="h-4 w-4" strokeWidth={1.75} />}
            />
            {WORKSPACE_SIDEBAR_LINKS.map((item) => {
              const href = workspacePath(clientId, item.segment);
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;

              return (
                <SidebarNavRow
                  key={item.segment}
                  to={href}
                  label={item.label}
                  isActive={isActive}
                  icon={
                    Icon ? <Icon className="h-4 w-4" strokeWidth={1.75} /> : undefined
                  }
                />
              );
            })}
          </>
        ) : (
          <>
            <p className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">
              Platform
            </p>
            {GLOBAL_NAV.map((item) => {
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
                  badge={item.to === "/admin" ? "LIVE" : undefined}
                />
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
