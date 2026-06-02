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
  runtimeStatus?: "idle" | "running" | "complete";
};

type ExecutorType = WorkflowExecutorType | "copy_reviewer" | string;

function executorBorderClass(executorType?: string) {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "border-emerald-800/80";
    case "apollo_search":
      return "border-cyan-800/80";
    case "deepseek_llm":
      return "border-violet-800/80";
    case "copy_reviewer":
      return "border-amber-700/80";
    case "approval_gate":
      return "border-rose-800/80";
    case "resend_email":
      return "border-blue-800/80";
    default:
      return "border-gray-700";
  }
}

function executorBadgeLabel(executorType?: string) {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "TRIGGER";
    case "apollo_search":
      return "APOLLO";
    case "deepseek_llm":
      return "WRITER";
    case "copy_reviewer":
      return "REVIEW";
    case "approval_gate":
      return "QUEUE";
    case "resend_email":
      return "RESEND";
    default:
      return "STEP";
  }
}

function humanReadableType(executorType?: string): string {
  switch (executorType as ExecutorType) {
    case "trigger":
      return "Trigger";
    case "apollo_search":
      return "Apollo Search";
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
    case "deepseek_llm": {
      const prompt = data.prompt?.replace(/\s+/g, " ").trim() ?? "";
      if (!prompt) return "No prompt configured";
      return prompt.length > 30 ? `${prompt.slice(0, 30)}…` : prompt;
    }
    case "resend_email":
      return `To: ${data.to?.trim() || "—"}`;
    case "copy_reviewer":
      return "Status: Reviewing Draft";
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
  const runtimeClass =
    nodeData.runtimeStatus === "running"
      ? "border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.5)]"
      : nodeData.runtimeStatus === "complete"
        ? "border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.5)]"
        : executorBorderClass(type);

  return (
    <div
      className={`min-w-[220px] max-w-[280px] border bg-gray-950 px-3 py-2.5 shadow-lg transition-colors ${runtimeClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        className="!h-3 !w-3 !border-2 !border-gray-500 !bg-gray-300"
      />
      <p className="text-center text-[8px] tracking-[0.18em] text-gray-500 uppercase">
        {executorBadgeLabel(type)}
      </p>
      <p className="pointer-events-none mt-0.5 text-center font-mono text-[11px] leading-snug tracking-[0.04em] text-gray-100">
        {displayTitle}
      </p>
      {contextPreview ? (
        <p className="pointer-events-none mt-1.5 border-t border-gray-800/80 pt-1.5 text-center text-[9px] leading-relaxed text-gray-500">
          {contextPreview}
        </p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        className="!h-3 !w-3 !border-2 !border-gray-500 !bg-emerald-400"
      />
    </div>
  );
}

export const WorkflowToolNode = memo(WorkflowToolNodeComponent);
