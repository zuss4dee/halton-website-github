import type { Edge } from "@xyflow/react";
import type { BulkLeadRow } from "@/lib/admin/bulkLeadCsv";
import { parseWorkflowGraph, toEnginePayload, type WorkflowGraph } from "@/lib/admin/workflowsRepository";
import { supabase } from "@/lib/supabase";

export type EngineWorkflowPayload = ReturnType<typeof toEnginePayload>;

export async function fetchActiveWorkflowGraph(
  clientId: string,
): Promise<WorkflowGraph | null> {
  const { data, error } = await supabase
    .from("workflows")
    .select("graph_json")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("BULK_INJECTOR_WORKFLOW_FETCH:", error);
    return null;
  }

  return parseWorkflowGraph(data?.graph_json);
}

export function patchWorkflowForLead(
  graph: WorkflowGraph,
  lead: BulkLeadRow,
): EngineWorkflowPayload {
  const triggerNode = graph.nodes.find((node) => node.type === "trigger");
  if (!triggerNode) {
    throw new Error("Active workflow has no trigger node.");
  }

  const nodes = graph.nodes.map((node) => {
    if (node.id !== triggerNode.id) {
      return {
        id: node.id,
        type: node.type,
        data: node.data,
      };
    }

    const existingData =
      typeof node.data === "object" && node.data !== null
        ? (node.data as Record<string, unknown>)
        : {};

    return {
      id: node.id,
      type: node.type,
      data: {
        ...existingData,
        email: lead.email,
        testEmail: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        ...(lead.website ? { website: lead.website } : {}),
        ...(lead.research_url ? { research_url: lead.research_url } : {}),
        ...(lead.linkedin_url ? { linkedin_url: lead.linkedin_url } : {}),
        bulkInjected: true,
      },
    };
  });

  const edges = graph.edges.map((edge: Edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));

  return { nodes, edges };
}

export async function invokeOutboundForLead(
  clientId: string,
  lead: BulkLeadRow,
  graph: WorkflowGraph,
): Promise<{ success: boolean; error?: string }> {
  const { nodes, edges } = patchWorkflowForLead(graph, lead);

  const { data, error } = await supabase.functions.invoke("run-outbound", {
    body: {
      clientId,
      testEmail: lead.email,
      nodes,
      edges,
      pipelineSource: "bulk_csv_inject",
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
