export const WORKSPACE_ATTENTION_INVALIDATE = "halton:workspace-attention-invalidate";

export function invalidateWorkspaceAttention(clientId?: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(WORKSPACE_ATTENTION_INVALIDATE, {
      detail: { clientId: clientId?.trim() ?? null },
    }),
  );
}
