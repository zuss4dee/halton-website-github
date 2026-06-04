import { normalizeAgentRole } from "@/lib/admin/agentActivity";

export type AgentStatusTone = "online" | "working" | "error" | "standby";

export type AgentStatus = {
  label: "Online" | "Working" | "Error" | "Standby";
  tone: AgentStatusTone;
};

export type AgentStatusInput = {
  role?: string | null;
  name?: string | null;
  model?: string | null;
  system_prompt?: string | null;
  is_active?: boolean | null;
};

export function statusPillClass(tone: AgentStatusTone): string {
  switch (tone) {
    case "online":
    case "working":
      return "bg-green-50 text-green-700";
    case "error":
      return "bg-red-50 text-red-700";
    case "standby":
      return "bg-yellow-50 text-yellow-700";
  }
}

export function getAgentStatus(
  agent: AgentStatusInput,
  isWorking = false,
): AgentStatus {
  const role = normalizeAgentRole(agent.role);

  if (role === "CEO_ROUTER" || role === "CEO") {
    return { label: "Online", tone: "online" };
  }

  if (agent.is_active === false) {
    return { label: "Standby", tone: "standby" };
  }

  const hasMissingData =
    !agent.name?.trim() ||
    !agent.role?.trim() ||
    !agent.model?.trim() ||
    !agent.system_prompt?.trim();

  if (hasMissingData) {
    return { label: "Error", tone: "error" };
  }

  if (isWorking) {
    return { label: "Working", tone: "working" };
  }

  return { label: "Standby", tone: "standby" };
}
