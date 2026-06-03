import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

/** Prefer workspace-specific agent rows over global templates for the same role. */
export function mergeAgentsForWorkspace(
  rows: AgentRosterRow[],
  clientId: string,
): AgentRosterRow[] {
  const byRole = new Map<string, AgentRosterRow>();

  for (const agent of rows) {
    const roleKey = agent.role?.trim().toUpperCase() || agent.id;
    const existing = byRole.get(roleKey);

    if (!existing) {
      byRole.set(roleKey, agent);
      continue;
    }

    const agentIsScoped = agent.client_id === clientId;
    const existingIsScoped = existing.client_id === clientId;

    if (agentIsScoped && !existingIsScoped) {
      byRole.set(roleKey, agent);
    }
  }

  return [...byRole.values()].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.role ?? "").localeCompare(b.role ?? "");
  });
}
