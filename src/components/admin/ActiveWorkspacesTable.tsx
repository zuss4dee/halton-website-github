import { Link } from "@tanstack/react-router";
import type { WorkspaceListItem } from "@/lib/admin/clientsRepository";
import { statusTone } from "@/lib/admin-workspaces";

type ActiveWorkspacesTableProps = {
  workspaces: WorkspaceListItem[];
  isLoading: boolean;
};

export function ActiveWorkspacesTable({ workspaces, isLoading }: ActiveWorkspacesTableProps) {
  return (
    <section id="workspaces" className="border-t border-hairline pt-12 md:pt-16">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow mb-3">— Registry</div>
          <h2 className="font-display text-3xl md:text-4xl tracking-[-0.035em] leading-[0.95]">
            Active Workspaces
          </h2>
        </div>
        <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
          {workspaces.length} clients · live
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="hidden md:grid md:grid-cols-12 gap-4 py-4 border-b border-hairline font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
          <div className="col-span-4">Client Company</div>
          <div className="col-span-2">Active Agents</div>
          <div className="col-span-3">Meetings Booked</div>
          <div className="col-span-3">Infrastructure Status</div>
        </div>

        {isLoading ? (
          <div className="py-16 px-4 text-center font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            LOADING_INFRASTRUCTURE...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-16 px-4 text-center font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            NO_ACTIVE_WORKSPACES
          </div>
        ) : (
          workspaces.map((row) => (
            <Link
              key={row.slug}
              to="/admin/client/$id"
              params={{ id: row.slug }}
              className="grid grid-cols-1 gap-3 border-b border-hairline py-6 md:grid-cols-12 md:items-baseline md:gap-4 md:py-7 transition-colors hover:bg-ink hover:text-paper group"
            >
              <div className="md:col-span-4">
                <div className="eyebrow mb-1 md:hidden group-hover:text-paper/70">Client Company</div>
                <div className="font-display text-xl md:text-2xl tracking-[-0.03em]">
                  {row.company}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="eyebrow mb-1 md:hidden group-hover:text-paper/70">Active Agents</div>
                <div className="font-mono text-[11px] tracking-[0.16em] uppercase">
                  {row.activeAgents}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden group-hover:text-paper/70">
                  Meetings Booked
                </div>
                <div className="font-mono text-[11px] tracking-[0.16em] uppercase">
                  {row.meetingsBooked}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="eyebrow mb-1 md:hidden group-hover:text-paper/70">
                  Infrastructure Status
                </div>
                <div
                  className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase group-hover:text-paper ${statusTone[row.infrastructureStatus]}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {row.infrastructureStatus}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
