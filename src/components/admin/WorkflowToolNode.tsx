import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorkflowExecutorType } from "@/lib/admin/workflowsRepository";

export type ToolNodeData = {
  label?: string;
  location?: string;
  title?: string;
  prompt?: string;
  draft?: string;
  to?: string;
  subject?: string;
  body?: string;
  template_id?: string;
  url?: string;
  task?: string;
  agentId?: string;
  runtimeStatus?: "idle" | "running" | "complete";
};

type ExecutorType = WorkflowExecutorType | "copy_reviewer" | string;

function executorAccentClass(executorType?: string) {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "border-l-emerald-500";
    case "apollo_search":
      return "border-l-cyan-500";
    case "agent_research":
      return "border-l-teal-500";
    case "deepseek_llm":
      return "border-l-violet-500";
    case "copy_reviewer":
      return "border-l-amber-500";
    case "approval_gate":
      return "border-l-rose-500";
    case "resend_email":
      return "border-l-blue-500";
    default:
      return "border-l-gray-400";
  }
}

function executorBadgeClass(executorType?: string) {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "bg-emerald-50 text-emerald-700";
    case "apollo_search":
      return "bg-cyan-50 text-cyan-700";
    case "agent_research":
      return "bg-teal-50 text-teal-700";
    case "deepseek_llm":
      return "bg-violet-50 text-violet-700";
    case "copy_reviewer":
      return "bg-amber-50 text-amber-700";
    case "approval_gate":
      return "bg-rose-50 text-rose-700";
    case "resend_email":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function executorBadgeLabel(executorType?: string) {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "Trigger";
    case "apollo_search":
      return "Apollo";
    case "agent_research":
      return "Research";
    case "deepseek_llm":
      return "Writer";
    case "copy_reviewer":
      return "Review";
    case "approval_gate":
      return "Queue";
    case "resend_email":
      return "Resend";
    default:
      return "Step";
  }
}

function humanReadableType(executorType?: string): string {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "Trigger";
    case "apollo_search":
      return "Apollo Search";
    case "agent_research":
      return "Agent Research";
    case "deepseek_llm":
      return "AI Writer";
    case "copy_reviewer":
      return "Deliverability Chief";
    case "approval_gate":
      return "Human Review Queue";
    case "resend_email":
      return "Resend Email";
    default:
      return "Workflow Step";
  }
}

function resolveDisplayTitle(label: string | undefined, executorType?: string): string {
  const trimmed = label?.trim();
  if (trimmed && trimmed.toLowerCase() !== "untitled step") {
    return trimmed;
  }
  return humanReadableType(executorType);
}

function buildContextPreview(executorType: string | undefined, data: ToolNodeData): string | null {
  switch (executorType as ExecutorType) {
    case "apollo_search":
      return `Target: ${data.title?.trim() || "Any"}`;
    case "agent_research": {
      const url = data.url?.replace(/\s+/g, " ").trim() ?? "";
      if (!url) return "Scrape company URL";
      return url.length > 30 ? `${url.slice(0, 30)}…` : url;
    }
    case "deepseek_llm": {
      const prompt = data.prompt?.replace(/\s+/g, " ").trim() ?? "";
      if (!prompt) return "No prompt configured";
      return prompt.length > 30 ? `${prompt.slice(0, 30)}…` : prompt;
    }
    case "resend_email": {
      const to = data.to?.trim() || "—";
      const templateHint = data.template_id ? " · Base template linked" : "";
      return `To: ${to}${templateHint}`;
    }
    case "copy_reviewer":
      return "Status: Reviewing draft";
    case "approval_gate": {
      const body = data.body?.trim() ?? "";
      if (!body) return "Queues reviewer copy";
      const flat = body.replace(/\s+/g, " ");
      return flat.length > 30 ? `${flat.slice(0, 30)}…` : flat;
    }
    case "trigger":
      return "Manual / test run";
    default:
      return null;
  }
}

function WorkflowToolNodeComponent({ data, type }: NodeProps) {
  const nodeData = (data ?? {}) as ToolNodeData;
  const displayTitle = resolveDisplayTitle(nodeData.label, type);
  const contextPreview = buildContextPreview(type, nodeData);
  const accentClass = executorAccentClass(type);
  const runtimeClass =
    nodeData.runtimeStatus === "running"
      ? "ring-2 ring-orange-300 ring-offset-2 ring-offset-gray-50"
      : nodeData.runtimeStatus === "complete"
        ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-gray-50"
        : "";

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-lg border border-gray-200 border-l-4 bg-white px-3 py-2.5 shadow-sm transition-shadow ${accentClass} ${runtimeClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        className="!h-3 !w-3 !border-2 !border-gray-300 !bg-white"
      />
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${executorBadgeClass(type)}`}
      >
        {executorBadgeLabel(type)}
      </span>
      <p className="pointer-events-none mt-1.5 text-sm font-semibold leading-snug text-gray-900">
        {displayTitle}
      </p>
      {contextPreview ? (
        <p className="pointer-events-none mt-1.5 border-t border-gray-100 pt-1.5 text-xs leading-relaxed text-gray-500">
          {contextPreview}
        </p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        className="!h-3 !w-3 !border-2 !border-gray-300 !bg-emerald-500"
      />
    </div>
  );
}

export const WorkflowToolNode = memo(WorkflowToolNodeComponent);
