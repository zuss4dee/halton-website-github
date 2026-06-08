import type { AgentLogRow } from "@/lib/admin/agentTelemetry";
import { normalizeAgentRole } from "@/lib/admin/agentActivity";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

const CEO_ROLES = new Set(["CEO", "CEO_ROUTER"]);

const ACTIVITY_EVENT_TYPES = new Set(["SPAWN", "THOUGHT", "TOOL_CALL", "TOOL_RESULT"]);

const WORKFLOW_AGENT_ROLES = ["DELIVERABILITY_CHIEF", "COPYWRITER"] as const;

function rosterHasRole(agents: AgentRosterRow[], role: string): boolean {
  return agents.some((agent) => normalizeAgentRole(agent.role) === role);
}

export function resolveActivityRoleFromLog(
  log: AgentLogRow,
  agents: AgentRosterRow[],
): string | null {
  const roles = resolveActivityRolesFromLog(log, agents);
  return roles[0] ?? null;
}

export function resolveActivityRolesFromLog(
  log: AgentLogRow,
  agents: AgentRosterRow[],
): string[] {
  const payload = log.payload ?? {};

  if (log.event_type === "TOOL_CALL") {
    const action = typeof payload.action === "string" ? payload.action : "";

    if (action === "SPAWNING_AGENT") {
      const target = typeof payload.target === "string" ? payload.target : null;
      if (target) {
        return [normalizeAgentRole(target)];
      }
    }

    if (action === "BUILD_AND_RUN_AUTOMATION") {
      return WORKFLOW_AGENT_ROLES.filter((role) => rosterHasRole(agents, role));
    }
  }

  if (!log.agent_id || !ACTIVITY_EVENT_TYPES.has(log.event_type)) {
    return [];
  }

  const match = agents.find((agent) => agent.id === log.agent_id);
  if (!match?.role) return [];

  const role = normalizeAgentRole(match.role);
  if (CEO_ROLES.has(role)) return [];

  return [role];
}
