export type ExecutiveOverrideInput = {
  node_id: string;
  corrected_payload: string;
  reason: string;
};

export type ExecutiveOverridePayload = ExecutiveOverrideInput & {
  prior_context?: Record<string, unknown>;
};

export function buildExecutiveOverrideNodeOutput(
  nodeType: string,
  correctedPayload: string,
): Record<string, unknown> {
  const trimmed = correctedPayload.trim();
  const base = {
    executiveOverride: true,
    source: "ceo_executive_override",
  };

  if (nodeType === "deepseek_llm" || nodeType === "copy_reviewer") {
    return {
      ...base,
      copy: trimmed,
      ...(nodeType === "copy_reviewer"
        ? {
            qa: {
              queueStatus: "approved",
              violations: [],
              source: "executive_override",
            },
          }
        : {}),
    };
  }

  if (nodeType === "approval_gate") {
    return {
      ...base,
      body: trimmed,
      copy: trimmed,
    };
  }

  return {
    ...base,
    copy: trimmed,
    value: trimmed,
  };
}
