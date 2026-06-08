export const AGENT_ACTIVITY_EVENT = "agent-activity";
export const AGENT_MISSION_EVENT = "agent-mission";

export type AgentActivityDetail = {
  role: string;
  /** How long to keep the working indicator without another pulse (ms). */
  holdMs?: number;
};

export type AgentMissionDetail = {
  active: boolean;
};

export function normalizeAgentRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? "";
}

export function dispatchAgentActivity(role: string, options?: { holdMs?: number }) {
  if (typeof window === "undefined") return;

  const normalized = normalizeAgentRole(role);
  if (!normalized) return;

  window.dispatchEvent(
    new CustomEvent<AgentActivityDetail>(AGENT_ACTIVITY_EVENT, {
      detail: { role: normalized, holdMs: options?.holdMs },
    }),
  );
}

export function dispatchAgentMissionState(active: boolean) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<AgentMissionDetail>(AGENT_MISSION_EVENT, {
      detail: { active },
    }),
  );
}
