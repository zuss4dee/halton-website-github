import type { BulkLeadRow } from "@/lib/admin/bulkLeadCsv";
import {
  fetchActiveWorkflowGraph,
  patchWorkflowForLead,
} from "@/lib/admin/bulkWorkflowRun";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type RegenerateOutboundDraftInput = {
  clientId: string;
  lead: LeadRow;
  reason: string;
  priorSubject?: string;
  priorBody?: string;
};

function readFormString(formData: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = formData?.[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function leadRowToBulkLeadRow(lead: LeadRow): BulkLeadRow {
  const nameParts = (lead.prospect_name ?? "").trim().split(/\s+/).filter(Boolean);
  const formData =
    lead.form_data && typeof lead.form_data === "object" && !Array.isArray(lead.form_data)
      ? lead.form_data
      : null;

  return {
    first_name: nameParts[0] || "there",
    last_name: nameParts.slice(1).join(" "),
    email: lead.email?.trim() ?? "",
    company: lead.target_company?.trim() || "their company",
    title: lead.target_role?.trim() || "Leader",
    ...(readFormString(formData, "website") ? { website: readFormString(formData, "website") } : {}),
    ...(readFormString(formData, "research_url")
      ? { research_url: readFormString(formData, "research_url") }
      : {}),
    ...(readFormString(formData, "linkedin_url")
      ? { linkedin_url: readFormString(formData, "linkedin_url") }
      : {}),
  };
}

export async function regenerateOutboundDraft(
  input: RegenerateOutboundDraftInput,
): Promise<{ success: boolean; error?: string }> {
  const clientId = input.clientId.trim();
  const reason = input.reason.trim();
  const email = input.lead.email?.trim();

  if (!clientId || !input.lead.id) {
    return { success: false, error: "Missing workspace or lead" };
  }
  if (!email) {
    return { success: false, error: "Lead has no email address" };
  }
  if (!reason) {
    return { success: false, error: "Add a short reason so the writer knows what to fix" };
  }

  const graph = await fetchActiveWorkflowGraph(clientId);
  if (!graph) {
    return { success: false, error: "No active workflow found for this workspace" };
  }

  const bulkLead = leadRowToBulkLeadRow(input.lead);
  const { nodes, edges } = patchWorkflowForLead(graph, bulkLead);

  const { data, error } = await supabase.functions.invoke("run-outbound", {
    body: {
      clientId,
      leadId: input.lead.id,
      testEmail: email,
      nodes,
      edges,
      operatorFeedback: reason,
      priorDraftSubject: input.priorSubject?.trim() || undefined,
      priorDraftBody: input.priorBody?.trim() || undefined,
      regenerateDraft: true,
      pipelineSource: "operator_regenerate",
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const payload = data as { error?: string; success?: boolean } | null;
  if (payload?.error) {
    return { success: false, error: payload.error };
  }

  return { success: payload?.success !== false };
}
