export type AgentOrgRow = {
  id: string;
  name: string | null;
  role: string | null;
  model: string | null;
  reports_to_agent_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

export type AgentOrgNode = AgentOrgRow & {
  children: AgentOrgNode[];
};

function isCeoRole(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase() ?? "";
  return normalized === "CEO" || normalized === "CEO_ROUTER";
}

function sortByCreated(a: AgentOrgRow, b: AgentOrgRow): number {
  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (aTime !== bTime) return aTime - bTime;
  return (a.role ?? "").localeCompare(b.role ?? "");
}

/** Builds a hierarchical tree from a flat workspace agent list. */
export function buildAgentOrgTree(agents: AgentOrgRow[]): AgentOrgNode[] {
  const active = agents.filter((agent) => agent.is_active !== false);
  if (active.length === 0) return [];

  const byId = new Map(active.map((agent) => [agent.id, agent]));
  const childrenOf = new Map<string, AgentOrgRow[]>();
  const ceoAgent = active.find((agent) => isCeoRole(agent.role));

  for (const agent of active) {
    if (isCeoRole(agent.role)) continue;

    const parentId = agent.reports_to_agent_id;
    if (parentId && byId.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(agent);
      childrenOf.set(parentId, siblings);
      continue;
    }

    if (ceoAgent) {
      const siblings = childrenOf.get(ceoAgent.id) ?? [];
      siblings.push(agent);
      childrenOf.set(ceoAgent.id, siblings);
      continue;
    }

    const orphans = childrenOf.get("__root__") ?? [];
    orphans.push(agent);
    childrenOf.set("__root__", orphans);
  }

  function toNode(agent: AgentOrgRow): AgentOrgNode {
    const kids = (childrenOf.get(agent.id) ?? []).slice().sort(sortByCreated);
    return { ...agent, children: kids.map(toNode) };
  }

  if (ceoAgent) {
    return [toNode(ceoAgent)];
  }

  const roots = (childrenOf.get("__root__") ?? []).slice().sort(sortByCreated);
  return roots.map(toNode);
}
