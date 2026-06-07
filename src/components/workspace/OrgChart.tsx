import type { AgentOrgNode } from "@/lib/workspace/buildAgentOrgTree";

type OrgChartProps = {
  tree: AgentOrgNode[];
  isLoading: boolean;
  error: string | null;
  hideHeader?: boolean;
};

function formatRole(role: string | null | undefined): string {
  const trimmed = role?.trim();
  if (!trimmed) return "—";
  return trimmed.replace(/_/g, " ");
}

function OrgChartNode({ node, isRoot = false }: { node: AgentOrgNode; isRoot?: boolean }) {
  const displayName = node.name?.trim() || formatRole(node.role);
  const hasChildren = node.children.length > 0;

  return (
    <li className={`org-chart-node${isRoot ? " org-chart-node--root" : ""}`}>
      <div className="org-chart-node-card">
        <article
          className={`relative z-10 w-[min(100%,240px)] border border-hairline bg-paper px-4 py-4 transition-colors hover:border-ink/30 ${
            isRoot ? "shadow-[0_1px_0_0_var(--color-ink)]" : ""
          }`}
        >
          <p className="font-display text-base leading-tight tracking-[-0.02em] text-ink">
            {displayName}
          </p>
          <dl className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[9px] tracking-[0.2em] text-ink/40 uppercase">
                Role
              </dt>
              <dd className="truncate font-mono text-[10px] tracking-[0.08em] text-ink/70 uppercase">
                {formatRole(node.role)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[9px] tracking-[0.2em] text-ink/40 uppercase">
                Model
              </dt>
              <dd className="truncate font-mono text-[10px] tracking-[0.06em] text-ink/60">
                {node.model?.trim() || "—"}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      {hasChildren ? (
        <>
          <div className="org-chart-stem-down" aria-hidden="true" />
          <ul className="org-chart-children">
            {node.children.map((child) => (
              <OrgChartNode key={child.id} node={child} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}

function OrgChartSkeleton() {
  return (
    <div className="flex flex-col items-center gap-16 py-8">
      <div className="h-[88px] w-[240px] animate-pulse border border-hairline bg-ink/[0.03]" />
      <div className="flex gap-16">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[88px] w-[220px] animate-pulse border border-hairline bg-ink/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}

export function OrgChart({ tree, isLoading, error, hideHeader = false }: OrgChartProps) {
  return (
    <section>
      {!hideHeader ? (
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-mono text-[11px] tracking-[0.3em] text-ink/45 uppercase">
            Agent Org Chart
          </h2>
          <p className="font-mono text-[10px] tracking-[0.18em] text-ink/35 uppercase">
            Reporting chain // live
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="font-mono text-[11px] tracking-[0.14em] text-ink/60 uppercase">
          {error}
        </p>
      ) : null}

      <div className="relative overflow-x-auto border border-hairline bg-paper px-4 py-12 md:px-10 md:py-14">
        <div className="pointer-events-none absolute top-3 left-3 font-mono text-[9px] tracking-[0.18em] text-ink/30 uppercase">
          FIG.02 · agent.chain
        </div>

        {isLoading ? (
          <OrgChartSkeleton />
        ) : tree.length === 0 ? (
          <p className="py-12 text-center font-mono text-[11px] tracking-[0.2em] text-ink/40 uppercase">
            No agents provisioned yet
          </p>
        ) : (
          <ul className="org-chart-root">
            {tree.map((root) => (
              <OrgChartNode key={root.id} node={root} isRoot />
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .org-chart-root,
        .org-chart-children {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .org-chart-root {
          display: flex;
          justify-content: center;
        }

        .org-chart-node {
          --org-link-height: 4.5rem;
          --org-sibling-gap: 3.5rem;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 calc(var(--org-sibling-gap) / 2);
        }

        .org-chart-node-card {
          position: relative;
          z-index: 1;
        }

        .org-chart-stem-down {
          width: 1px;
          height: var(--org-link-height);
          background: var(--color-hairline);
          flex-shrink: 0;
        }

        .org-chart-children {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          position: relative;
          padding-top: 0;
          margin-top: 0;
        }

        .org-chart-children > .org-chart-node:not(:only-child) {
          padding-top: var(--org-link-height);
        }

        /* Upward stem from horizontal rail down to each child card */
        .org-chart-children > .org-chart-node::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          width: 1px;
          height: var(--org-link-height);
          background: var(--color-hairline);
          transform: translateX(-50%);
          z-index: 0;
        }

        /* Horizontal rail segments between siblings */
        .org-chart-children > .org-chart-node::after {
          content: "";
          position: absolute;
          top: 0;
          height: 1px;
          background: var(--color-hairline);
          z-index: 0;
        }

        .org-chart-children > .org-chart-node:first-child::after {
          left: 50%;
          right: 0;
        }

        .org-chart-children > .org-chart-node:last-child::after {
          left: 0;
          right: 50%;
        }

        .org-chart-children > .org-chart-node:not(:first-child):not(:last-child)::after {
          left: 0;
          right: 0;
        }

        /* Single child: one vertical line from parent, no duplicate stem */
        .org-chart-children > .org-chart-node:only-child::before {
          display: none;
        }

        .org-chart-children > .org-chart-node:only-child::after {
          display: none;
        }

        @media (min-width: 768px) {
          .org-chart-node {
            --org-link-height: 5rem;
            --org-sibling-gap: 4.5rem;
          }
        }
      `}</style>
    </section>
  );
}
