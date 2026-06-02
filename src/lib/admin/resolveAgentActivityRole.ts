import type { AgentLogRow } from "@/lib/admin/agentTelemetry";
import { normalizeAgentRole } from "@/lib/admin/agentActivity";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

const CEO_ROLES = new Set(["CEO", "CEO_ROUTER"]);

const ACTIVITY_EVENT_TYPES = new Set(["SPAWN", "THOUGHT", "TOOL_CALL", "TOOL_RESULT"]);

export function resolveActivityRoleFromLog(
  log: AgentLogRow,
  agents: AgentRosterRow[],
): string | null {
  const payload = log.payload ?? {};

  if (log.event_type === "TOOL_CALL") {
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "SPAWNING_AGENT") {
      const target = typeof payload.target === "string" ? payload.target : null;
      if (target) return normalizeAgentRole(target);
    }
  }

  if (!log.agent_id || !ACTIVITY_EVENT_TYPES.has(log.event_type)) {
    return null;
  }

  const match = agents.find((agent) => agent.id === log.agent_id);
  if (!match?.role) return null;

  const role = normalizeAgentRole(match.role);
  if (CEO_ROLES.has(role)) return null;

  return role;
}
