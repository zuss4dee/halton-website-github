export type AgentLogEventType = "SPAWN" | "THOUGHT" | "TOOL_CALL";

export type AgentLogRow = {
  id: string;
  execution_id: string;
  client_id?: string;
  agent_id: string;
  event_type: AgentLogEventType | string;
  payload: Record<string, unknown>;
  created_at?: string;
};

export function sortAgentLogs(logs: AgentLogRow[]): AgentLogRow[] {
  return [...logs].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
}

/** Outbound workflow step logs — hidden from mission control by default. */
export const OPERATIONAL_PIPELINE_EVENT_TYPES = new Set([
  "STEP_START",
  "STEP_COMPLETE",
  "OUTBOUND_PIPELINE",
]);

export function isOperationalPipelineLog(log: AgentLogRow): boolean {
  return OPERATIONAL_PIPELINE_EVENT_TYPES.has(log.event_type);
}

const MISSION_CONTROL_EVENT_TYPES = new Set(["SPAWN", "THOUGHT", "TOOL_CALL", "TOOL_RESULT"]);

export function isMissionControlLog(log: AgentLogRow): boolean {
  return MISSION_CONTROL_EVENT_TYPES.has(log.event_type);
}

export function formatAgentLogLine(log: AgentLogRow): string {
  const payload = log.payload ?? {};

  if (log.event_type === "SPAWN") {
    const command = typeof payload.command === "string" ? payload.command : "";
    return `> [SYSTEM] INITIALIZING ROUTER: "${command}"`;
  }

  if (log.event_type === "THOUGHT") {
    const thought = typeof payload.thought === "string" ? payload.thought : "";
    return `> [HALTON_ALPHA - CEO]: ${thought}`;
  }

  if (log.event_type === "TOOL_CALL") {
    const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "UNKNOWN";
    const args = payload.args ?? {};
    return `> [TOOL_EXECUTION] CALLING TOOL: ${toolName} WITH ARGS: ${JSON.stringify(args)}`;
  }

  return `> [${log.event_type}] ${JSON.stringify(payload)}`;
}
