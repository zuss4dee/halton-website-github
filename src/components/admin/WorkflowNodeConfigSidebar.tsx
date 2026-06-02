import { useEffect, useState, type ReactNode } from "react";
import {
  dataForExecutorType,
  readWorkflowNodeData,
  type WorkflowNodeData,
} from "@/lib/admin/workflowNodeConfig";
import {
  WORKFLOW_EXECUTOR_TYPES,
  type WorkflowExecutorType,
} from "@/lib/admin/workflowsRepository";

type WorkflowNodeConfigSidebarProps = {
  nodeId: string;
  nodeType: WorkflowExecutorType;
  nodeData: WorkflowNodeData;
  onPatch: (patch: { type?: WorkflowExecutorType; data?: WorkflowNodeData }) => void;
  onDelete: () => void;
};

const EXECUTOR_LABELS: Record<WorkflowExecutorType, string> = {
  trigger: "Trigger",
  apollo_search: "Apollo Search",
  deepseek_llm: "DeepSeek LLM",
  copy_reviewer: "Deliverability Chief",
  approval_gate: "Human Review Queue",
  resend_email: "Resend Email",
};

const fieldClassName =
  "mt-1 w-full border border-gray-700 bg-gray-950 px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-gray-500";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] tracking-[0.14em] text-gray-500 uppercase">{children}</span>
  );
}

export function WorkflowNodeConfigSidebar({
  nodeId,
  nodeType,
  nodeData,
  onPatch,
  onDelete,
}: WorkflowNodeConfigSidebarProps) {
  const [draftType, setDraftType] = useState<WorkflowExecutorType>(nodeType);
  const [draftData, setDraftData] = useState<WorkflowNodeData>(nodeData);

  useEffect(() => {
    setDraftType(nodeType);
    setDraftData(nodeData);
  }, [nodeId]);

  const applyDataPatch = (partial: WorkflowNodeData) => {
    setDraftData((current) => ({ ...current, ...partial }));
    onPatch({ data: partial });
  };

  const handleTypeChange = (nextType: WorkflowExecutorType) => {
    const nextData = dataForExecutorType(nextType, draftData);
    setDraftType(nextType);
    setDraftData(nextData);
    onPatch({ type: nextType, data: nextData });
  };

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-800 bg-black font-mono">
      <div className="border-b border-gray-800 px-4 py-3">
        <p className="text-[10px] tracking-[0.16em] text-gray-500 uppercase">Node config</p>
        <p className="mt-1 truncate text-[11px] text-gray-300">{nodeId}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <label className="block">
          <FieldLabel>Step label</FieldLabel>
          <input
            type="text"
            className={fieldClassName}
            value={draftData.label ?? ""}
            onChange={(event) => applyDataPatch({ label: event.target.value })}
          />
        </label>

        <label className="block">
          <FieldLabel>Node type</FieldLabel>
          <select
            className={fieldClassName}
            value={draftType}
            onChange={(event) => handleTypeChange(event.target.value as WorkflowExecutorType)}
          >
            {WORKFLOW_EXECUTOR_TYPES.map((type) => (
              <option key={type} value={type}>
                {EXECUTOR_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        {draftType === "apollo_search" ? (
          <>
            <label className="block">
              <FieldLabel>Location</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.location ?? ""}
                onChange={(event) => applyDataPatch({ location: event.target.value })}
                placeholder="United Kingdom"
              />
            </label>
            <label className="block">
              <FieldLabel>Title</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.title ?? ""}
                onChange={(event) => applyDataPatch({ title: event.target.value })}
                placeholder="Agency Director, Founder"
              />
            </label>
          </>
        ) : null}

        {draftType === "deepseek_llm" ? (
          <label className="block">
            <FieldLabel>Prompt</FieldLabel>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-600">
              Use {"{{steps.nodeId.field}}"} to inject prior step outputs.
            </p>
            <textarea
              className={`${fieldClassName} mt-2 min-h-[140px] resize-y`}
              value={draftData.prompt ?? ""}
              onChange={(event) => applyDataPatch({ prompt: event.target.value })}
              placeholder="Write outreach copy for {{steps.apollo-1.first_name}}..."
            />
          </label>
        ) : null}

        {draftType === "copy_reviewer" ? (
          <label className="block">
            <FieldLabel>Draft source</FieldLabel>
            <input
              type="text"
              className={fieldClassName}
              value={draftData.draft ?? ""}
              onChange={(event) => applyDataPatch({ draft: event.target.value })}
              placeholder="{{steps.llm-1.copy}}"
            />
          </label>
        ) : null}

        {draftType === "approval_gate" ? (
          <>
            <label className="block">
              <FieldLabel>Subject</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.subject ?? ""}
                onChange={(event) => applyDataPatch({ subject: event.target.value })}
              />
            </label>
            <label className="block">
              <FieldLabel>Body (reviewer copy)</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.body ?? ""}
                onChange={(event) => applyDataPatch({ body: event.target.value })}
                placeholder="{{steps.reviewer-1.copy}}"
              />
            </label>
          </>
        ) : null}

        {draftType === "resend_email" ? (
          <>
            <label className="block">
              <FieldLabel>To</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.to ?? ""}
                onChange={(event) => applyDataPatch({ to: event.target.value })}
                placeholder="{{steps.trigger-1.email}}"
              />
            </label>
            <label className="block">
              <FieldLabel>Subject</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.subject ?? ""}
                onChange={(event) => applyDataPatch({ subject: event.target.value })}
              />
            </label>
            <label className="block">
              <FieldLabel>Body</FieldLabel>
              <textarea
                className={`${fieldClassName} min-h-[120px] resize-y`}
                value={draftData.body ?? ""}
                onChange={(event) => applyDataPatch({ body: event.target.value })}
              />
            </label>
          </>
        ) : null}

        {draftType === "trigger" ? (
          <p className="text-[10px] leading-relaxed text-gray-600">
            Trigger steps pass the safemode test email into the execution context when you run
            the DAG.
          </p>
        ) : null}
      </div>

      <div className="border-t border-gray-800 p-4">
        <button
          type="button"
          onClick={onDelete}
          className="w-full border border-red-900 bg-red-950/40 px-3 py-2 text-[10px] tracking-[0.12em] text-red-400 uppercase transition-colors hover:border-red-700 hover:bg-red-950/70"
        >
          Delete Step
        </button>
      </div>
    </aside>
  );
}

export function buildSidebarPropsFromNode(node: {
  id: string;
  type?: string;
  data?: unknown;
}) {
  const type = WORKFLOW_EXECUTOR_TYPES.includes(node.type as WorkflowExecutorType)
    ? (node.type as WorkflowExecutorType)
    : "deepseek_llm";

  return {
    nodeId: node.id,
    nodeType: type,
    nodeData: readWorkflowNodeData(node.data),
  };
}
