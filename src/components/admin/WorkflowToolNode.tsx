import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorkflowExecutorType } from "@/lib/admin/workflowsRepository";

export type ToolNodeData = {
  label: string;
  prompt?: string;
  to?: string;
  subject?: string;
  body?: string;
};

function executorBorderClass(executorType?: string) {
  switch (executorType as WorkflowExecutorType | undefined) {
    case "trigger":
      return "border-emerald-800/80";
    case "apollo_search":
      return "border-cyan-800/80";
    case "deepseek_llm":
      return "border-violet-800/80";
    case "resend_email":
      return "border-blue-800/80";
    default:
      return "border-gray-700";
  }
}

function executorTypeLabel(executorType?: string) {
  switch (executorType as WorkflowExecutorType | undefined) {
    case "trigger":
      return "TRIGGER";
    case "apollo_search":
      return "APOLLO";
    case "deepseek_llm":
      return "LLM";
    case "resend_email":
      return "RESEND";
    default:
      return "STEP";
  }
}

function WorkflowToolNodeComponent({ data, type }: NodeProps) {
  const nodeData = (data ?? { label: "Step" }) as ToolNodeData;
  const label = nodeData.label ?? "Step";

  return (
    <div
      className={`min-w-[240px] max-w-[300px] border bg-gray-900 px-4 py-3 shadow-lg ${executorBorderClass(type)}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        className="!h-3 !w-3 !border-2 !border-gray-500 !bg-gray-300"
      />
      <p className="mb-1 text-center text-[9px] tracking-[0.16em] text-gray-500 uppercase">
        {executorTypeLabel(type)}
      </p>
      <p className="pointer-events-none text-center text-[11px] leading-snug tracking-[0.06em] text-gray-200">
        {label}
      </p>
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
