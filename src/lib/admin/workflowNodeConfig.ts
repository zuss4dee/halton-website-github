import type { WorkflowExecutorType } from "@/lib/admin/workflowsRepository";

export type WorkflowNodeData = {
  label?: string;
  location?: string;
  title?: string;
  prompt?: string;
  draft?: string;
  to?: string;
  subject?: string;
  body?: string;
  template_id?: string;
  /** agent_research: URL template, e.g. {{steps.apollo-1.website}} */
  url?: string;
  /** agent_research: optional roster agent UUID */
  agentId?: string;
  /** agent_research: fallback role when agentId omitted */
  agentRole?: string;
  /** agent_research: extra condense instructions (CEO-defined) */
  task?: string;
};

export function defaultLabelForType(type: WorkflowExecutorType): string {
  switch (type) {
    case "trigger":
      return "[ TRIGGER ] - Manual / Test Run";
    case "apollo_search":
      return "[ APOLLO ] - Search & Enrich Lead";
    case "agent_research":
      return "[ RESEARCH ] - Company / URL Scrape";
    case "deepseek_llm":
      return "[ DEEPSEEK ] - Draft Copy";
    case "copy_reviewer":
      return "[ REVIEW ] - Deliverability Chief";
    case "approval_gate":
      return "[ GATE ] - Human Review Queue";
    case "resend_email":
      return "[ RESEND ] - Send Email";
  }
}

export function dataForExecutorType(
  type: WorkflowExecutorType,
  existing: WorkflowNodeData = {},
): WorkflowNodeData {
  const label = existing.label?.trim() || defaultLabelForType(type);

  switch (type) {
    case "trigger":
      return { label };
    case "apollo_search":
      return {
        label,
        location: existing.location ?? "United Kingdom",
        title: existing.title ?? "Agency Director, Founder",
      };
    case "agent_research":
      return {
        label: existing.label?.trim() || "Company Research",
        url: existing.url ?? "{{steps.apollo-1.website}}",
        task:
          existing.task ??
          "Summarize what the company sells, who they serve, and one outreach hook. Use only scraped facts.",
        ...(existing.agentId ? { agentId: existing.agentId } : {}),
        ...(existing.agentRole ? { agentRole: existing.agentRole } : {}),
      };
    case "deepseek_llm":
      return {
        label: "DeepSeek Writer",
        prompt:
          existing.prompt ??
          "Write a casual, 2-sentence cold email opening line to {{steps.apollo-1.first_name}}, the {{steps.apollo-1.title}} at {{steps.apollo-1.company}}.",
      };
    case "copy_reviewer":
      return {
        label: "Deliverability Chief",
        draft: existing.draft ?? "{{steps.llm-1.copy}}",
      };
    case "approval_gate":
      return {
        label,
        subject: existing.subject ?? "Quick question for {{steps.apollo-1.company}}",
        body: existing.body ?? "{{steps.reviewer-1.copy}}",
      };
    case "resend_email":
      return {
        label,
        to: existing.to ?? "{{steps.trigger-1.email}}",
        subject: existing.subject ?? "Quick question for {{steps.apollo-1.company}}",
        template_id: existing.template_id,
        body: existing.body,
      };
  }
}

export function readWorkflowNodeData(data: unknown): WorkflowNodeData {
  if (!data || typeof data !== "object") return {};
  return data as WorkflowNodeData;
}
