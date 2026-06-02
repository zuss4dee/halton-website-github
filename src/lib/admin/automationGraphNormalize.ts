export const DEEPSEEK_WRITER_LABEL = "DeepSeek Writer";
export const COPY_REVIEWER_LABEL = "Deliverability Chief";

export type AutomationGraphNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
};

function nodeData(node: AutomationGraphNode): Record<string, unknown> {
  if (!node.data || typeof node.data !== "object") {
    node.data = {};
  }
  return node.data;
}

function isCopyReviewerLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized === COPY_REVIEWER_LABEL.toLowerCase() ||
    normalized.includes("deliverability")
  );
}

function isWriterLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized === DEEPSEEK_WRITER_LABEL.toLowerCase() ||
    normalized === "ai writer" ||
    (normalized.includes("writer") && !normalized.includes("deliverability"))
  );
}

/** Fixes CEO mislabels (e.g. copy_reviewer shown as "AI Writer") and enforces DAG wiring. */
export function normalizeAutomationGraph(nodes: AutomationGraphNode[]): AutomationGraphNode[] {
  const normalized = nodes.map((node) => ({
    ...node,
    data: { ...(node.data ?? {}) },
  }));

  for (const node of normalized) {
    const data = nodeData(node);
    const label = typeof data.label === "string" ? data.label.trim() : "";

    if (node.type === "copy_reviewer" || isCopyReviewerLabel(label)) {
      node.type = "copy_reviewer";
      data.label = COPY_REVIEWER_LABEL;
    }

    if (node.type === "deepseek_llm" || (isWriterLabel(label) && node.type !== "copy_reviewer")) {
      node.type = "deepseek_llm";
      data.label = DEEPSEEK_WRITER_LABEL;
    }
  }

  const writerNode = normalized.find((node) => node.type === "deepseek_llm");
  const reviewerNode = normalized.find((node) => node.type === "copy_reviewer");

  if (writerNode && reviewerNode) {
    const reviewerData = nodeData(reviewerNode);
    reviewerData.draft = `{{steps.${writerNode.id}.copy}}`;
  }

  if (reviewerNode) {
    const reviewerRef = `{{steps.${reviewerNode.id}.copy}}`;
    for (const node of normalized) {
      if (node.type === "resend_email" || node.type === "approval_gate") {
        const data = nodeData(node);
        data.body = reviewerRef;
      }
    }
  }

  return normalized;
}
