export const AGENT_ACTIVITY_EVENT = "agent-activity";

export type AgentActivityDetail = {
  role: string;
};

export function normalizeAgentRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? "";
}

export function dispatchAgentActivity(role: string) {
  if (typeof window === "undefined") return;

  const normalized = normalizeAgentRole(role);
  if (!normalized) return;

  window.dispatchEvent(
    new CustomEvent<AgentActivityDetail>(AGENT_ACTIVITY_EVENT, {
      detail: { role: normalized },
    }),
  );
}
