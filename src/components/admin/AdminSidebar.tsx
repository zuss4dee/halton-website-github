import { Link, useRouterState } from "@tanstack/react-router";
import {
  GLOBAL_NAV,
  WORKSPACE_NAV,
  workspacePath,
} from "@/lib/admin/adminNav";

function navLinkClass(isActive: boolean) {
  return `block w-full px-4 py-3 font-mono text-xs tracking-[0.16em] uppercase transition-colors ${
    isActive
      ? "bg-ink text-paper"
      : "text-ink-soft hover:bg-gray-900 hover:text-paper"
  }`;
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWorkspace = pathname.includes("/admin/client/");
  const clientId = isWorkspace
    ? (pathname.split("/admin/client/")[1]?.split("/")[0] ?? null)
    : null;

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-hairline md:w-56 md:min-w-56 md:max-w-56 md:border-b-0 md:border-r">
      <div className="border-b border-hairline px-6 py-6 md:px-5">
        <Link
          to="/"
          className="block font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          ← Site
        </Link>
        <div className="mt-6 font-display text-2xl leading-none tracking-[-0.035em]">
          Halton<span className="text-ink-soft">/Works</span>
        </div>
        <div className="eyebrow mt-2">Owner · Command</div>
      </div>

      <nav className="flex flex-1 flex-col gap-0 px-2 py-4 md:px-3">
        {isWorkspace && clientId ? (
          <>
            <div className="mb-3 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-ink">
              [ Tenant Scoped View ]
            </div>
            {WORKSPACE_NAV.map((item, index) => {
              if (index === 0) {
                return (
                  <Link
                    key={item.label}
                    to="/admin"
                    className={navLinkClass(false)}
                  >
                    {item.label}
                  </Link>
                );
              }

              const href = workspacePath(clientId, item.segment);
              const isActive =
                item.segment === ""
                  ? pathname === href || pathname === `${href}/`
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link key={item.label} to={href} className={navLinkClass(isActive)}>
                  {item.label}
                </Link>
              );
            })}
          </>
        ) : (
          GLOBAL_NAV.map((item) => {
            const isActive =
              item.to === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);

            return (
              <Link key={item.label} to={item.to} className={navLinkClass(isActive)}>
                {item.label}
              </Link>
            );
          })
        )}
      </nav>

      <div className="border-t border-hairline px-6 py-5 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft md:px-5">
        <div className="mb-1 text-ink">System</div>
        <div>{isWorkspace ? "Tenant channel active" : "All channels nominal"}</div>
      </div>
    </aside>
  );
}
