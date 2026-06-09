import type { Edge, Node } from "@xyflow/react";

export type WorkflowGraph = {
  nodes: Node[];
  edges: Edge[];
};

export type WorkflowRow = {
  id?: string;
  client_id: string;
  graph_json?: WorkflowGraph | null;
  is_active?: boolean | null;
};

export const WORKFLOW_EXECUTOR_TYPES = [
  "trigger",
  "apollo_search",
  "deepseek_llm",
  "copy_reviewer",
  "approval_gate",
  "resend_email",
] as const;

export type WorkflowExecutorType = (typeof WORKFLOW_EXECUTOR_TYPES)[number];

export const HALTON_SAAS_WRITER_PROMPT =
  "Write a casual, 2-3 sentence cold email to {{steps.apollo-1.first_name}}, the {{steps.apollo-1.title}} at {{steps.apollo-1.company}}. Reference a specific challenge B2B SaaS founders face: outbound pipeline bottlenecks or primary-domain deliverability risk. Position permanent revenue infrastructure (not an agency). End with a soft ask for a 15-minute call. Do not include placeholders or signature blocks.";

export const HALTON_APOLLO_ICP = {
  location: "United Kingdom, United States",
  title: "Founder, CEO, Co-Founder",
} as const;

export const DEFAULT_WORKFLOW_GRAPH: WorkflowGraph = {
  nodes: [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 250, y: 40 },
      data: {
        label: "[ TRIGGER ] - Manual / Test Run",
      },
    },
    {
      id: "apollo-1",
      type: "apollo_search",
      position: { x: 250, y: 160 },
      data: {
        label: "[ APOLLO ] - Search & Enrich Lead",
        location: HALTON_APOLLO_ICP.location,
        title: HALTON_APOLLO_ICP.title,
      },
    },
    {
      id: "llm-1",
      type: "deepseek_llm",
      position: { x: 250, y: 280 },
      data: {
        label: "DeepSeek Writer",
        prompt: HALTON_SAAS_WRITER_PROMPT,
      },
    },
    {
      id: "reviewer-1",
      type: "copy_reviewer",
      position: { x: 250, y: 400 },
      data: {
        label: "Deliverability Chief",
        draft: "{{steps.llm-1.copy}}",
      },
    },
    {
      id: "gate-1",
      type: "approval_gate",
      position: { x: 250, y: 520 },
      data: {
        label: "Human Review Queue",
        subject: "Quick question for {{steps.apollo-1.company}}",
        body: "{{steps.reviewer-1.copy}}",
      },
    },
    {
      id: "email-1",
      type: "resend_email",
      position: { x: 250, y: 640 },
      data: {
        label: "Send Email",
        to: "{{steps.trigger-1.email}}",
        subject: "Quick question for {{steps.apollo-1.company}}",
        body: "{{steps.reviewer-1.copy}}",
      },
    },
  ],
  edges: [
    {
      id: "e-trigger-apollo",
      source: "trigger-1",
      target: "apollo-1",
      animated: true,
      style: { stroke: "#4b5563" },
    },
    {
      id: "e-apollo-llm",
      source: "apollo-1",
      target: "llm-1",
      animated: true,
      style: { stroke: "#4b5563" },
    },
    {
      id: "e-llm-reviewer",
      source: "llm-1",
      target: "reviewer-1",
      animated: true,
      style: { stroke: "#4b5563" },
    },
    {
      id: "e-reviewer-gate",
      source: "reviewer-1",
      target: "gate-1",
      animated: true,
      style: { stroke: "#4b5563" },
    },
    {
      id: "e-gate-email",
      source: "gate-1",
      target: "email-1",
      animated: true,
      style: { stroke: "#22c55e" },
    },
  ],
};

function readPosition(node: Node): { x: number; y: number } {
  const pos = node.position;
  if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
    return { x: pos.x, y: pos.y };
  }
  return { x: 0, y: 0 };
}

function isExecutorType(type: string | undefined): type is WorkflowExecutorType {
  return WORKFLOW_EXECUTOR_TYPES.includes(type as WorkflowExecutorType);
}

export function parseWorkflowGraph(value: unknown): WorkflowGraph | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const nodes = record.nodes;
  const edges = record.edges;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null;

  return {
    nodes: normalizeLoadedNodes(nodes),
    edges: edges as Edge[],
  };
}

export function normalizeLoadedNodes(nodes: unknown[]): Node[] {
  return nodes.map((raw) => {
    const node = raw as Node;
    const rawData =
      typeof node.data === "object" && node.data !== null
        ? (node.data as Record<string, unknown>)
        : {};

    const label =
      typeof rawData.label === "string" ? rawData.label.trim() : "";

    const type = isExecutorType(node.type) ? node.type : "deepseek_llm";

    return {
      id: String(node.id),
      type,
      position: readPosition(node),
      data: {
        ...rawData,
        label,
      },
    };
  });
}

export function toEnginePayload(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}
