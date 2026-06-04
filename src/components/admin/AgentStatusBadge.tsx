import { statusPillClass, type AgentStatus } from "@/lib/admin/agentStatus";

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusPillClass(status.tone)}`}
    >
      {status.label}
    </span>
  );
}
