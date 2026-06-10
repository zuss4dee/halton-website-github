import { useEffect, useState, type ReactNode } from "react";
import {
  dataForExecutorType,
  readWorkflowNodeData,
  type WorkflowNodeData,
} from "@/lib/admin/workflowNodeConfig";
import type { EmailTemplateRow } from "@/lib/admin/emailTemplatesRepository";
import {
  WORKFLOW_EXECUTOR_TYPES,
  type WorkflowExecutorType,
} from "@/lib/admin/workflowsRepository";

type WorkflowNodeConfigSidebarProps = {
  nodeId: string;
  nodeType: WorkflowExecutorType;
  nodeData: WorkflowNodeData;
  emailTemplates: EmailTemplateRow[];
  templatesLoading?: boolean;
  onPatch: (patch: { type?: WorkflowExecutorType; data?: WorkflowNodeData }) => void;
  onDelete: () => void;
};

const EXECUTOR_LABELS: Record<WorkflowExecutorType, string> = {
  trigger: "Trigger",
  apollo_search: "Apollo Search",
  agent_research: "Agent Research",
  deepseek_llm: "DeepSeek LLM",
  copy_reviewer: "Deliverability Chief",
  approval_gate: "Human Review Queue",
  resend_email: "Resend Email",
};

const fieldClassName =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-gray-700">{children}</span>;
}

export function WorkflowNodeConfigSidebar({
  nodeId,
  nodeType,
  nodeData,
  emailTemplates,
  templatesLoading = false,
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
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <p className="text-sm font-medium text-gray-900">Node config</p>
        <p className="mt-1 truncate text-xs text-gray-500">{nodeId}</p>
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

        {draftType === "agent_research" ? (
          <>
            <label className="block">
              <FieldLabel>Research URL template</FieldLabel>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Usually {"{{steps.<apollo_id>.website}}"} — falls back to research_url / linkedin_url on the lead.
              </p>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.url ?? ""}
                onChange={(event) => applyDataPatch({ url: event.target.value })}
                placeholder="{{steps.apollo-1.website}}"
              />
            </label>
            <label className="block">
              <FieldLabel>Agent ID (optional)</FieldLabel>
              <input
                type="text"
                className={fieldClassName}
                value={draftData.agentId ?? ""}
                onChange={(event) => applyDataPatch({ agentId: event.target.value })}
                placeholder="Roster UUID — omit for default condenser"
              />
            </label>
            <label className="block">
              <FieldLabel>Condense task</FieldLabel>
              <textarea
                className={`${fieldClassName} mt-2 min-h-[100px] resize-y`}
                value={draftData.task ?? ""}
                onChange={(event) => applyDataPatch({ task: event.target.value })}
                placeholder="What to extract from the scrape for the writer…"
              />
            </label>
          </>
        ) : null}

        {draftType === "deepseek_llm" ? (
          <label className="block">
            <FieldLabel>Prompt</FieldLabel>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
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
            <div className="block">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <FieldLabel>Select Base Template</FieldLabel>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium leading-snug text-gray-600">
                  AI will automatically personalize variables (e.g., {"{{first_name}}"})
                </span>
              </div>
              <select
                className={fieldClassName}
                value={draftData.template_id ?? ""}
                disabled={templatesLoading}
                onChange={(event) => {
                  const templateId = event.target.value;
                  applyDataPatch({ template_id: templateId || undefined });
                }}
              >
                <option value="">
                  {templatesLoading ? "Loading templates…" : "Choose a template…"}
                </option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {!templatesLoading && emailTemplates.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  No templates yet. Create one in Template Library.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {draftType === "trigger" ? (
          <p className="text-xs leading-relaxed text-gray-500">
            Trigger steps pass the safemode test email into the execution context when you run
            the DAG.
          </p>
        ) : null}
      </div>

      <div className="border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
        >
          Delete step
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
