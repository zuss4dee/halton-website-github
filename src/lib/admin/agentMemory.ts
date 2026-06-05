import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServer } from "@/lib/supabase-server";

export const AGENT_MEMORY_GLOBAL_WORKSPACE_ID = "GLOBAL" as const;

export type AgentMemoryOutcome = "SUCCESS" | "FAILURE";

export type AgentMemoryRow = {
  id: string;
  workspace_id: string;
  task_summary: string;
  outcome: AgentMemoryOutcome;
  learned_strategy: string;
  created_at: string;
};

export type LogOperationalObservationInput = {
  summary: string;
  outcome: AgentMemoryOutcome;
  strategy: string;
  scope?: "GLOBAL" | "LOCAL";
};

function normalizeOutcome(value: string): AgentMemoryOutcome | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "SUCCESS" || normalized === "FAILURE") {
    return normalized;
  }
  return null;
}

export function formatOperationalMemorySection(rows: AgentMemoryRow[]): string {
  if (rows.length === 0) {
    return "No operational memory recorded yet. Use logOperationalObservation after missions to build your lesson library.";
  }

  return rows
    .map((row) => {
      const scope = row.workspace_id === AGENT_MEMORY_GLOBAL_WORKSPACE_ID ? "GLOBAL" : "LOCAL";
      return `- [${row.outcome}] (${scope}) ${row.task_summary} → ${row.learned_strategy}`;
    })
    .join("\n");
}

export async function fetchOperationalMemory(
  clientId: string,
  db?: SupabaseClient,
): Promise<{ rows: AgentMemoryRow[]; error?: string }> {
  const supabase = db ?? getSupabaseServer();
  const workspaceClientId = clientId.trim();

  if (!workspaceClientId) {
    return { rows: [], error: "clientId is required." };
  }

  const { data, error } = await supabase
    .from("agent_memory")
    .select("id, workspace_id, task_summary, outcome, learned_strategy, created_at")
    .in("workspace_id", [AGENT_MEMORY_GLOBAL_WORKSPACE_ID, workspaceClientId])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as AgentMemoryRow[] };
}

export async function logOperationalObservation(
  clientId: string,
  input: LogOperationalObservationInput,
  db?: SupabaseClient,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = db ?? getSupabaseServer();
  const workspaceClientId = clientId.trim();
  const summary = input.summary.trim();
  const strategy = input.strategy.trim();
  const outcome = normalizeOutcome(input.outcome);

  if (!workspaceClientId) {
    return { ok: false, error: "clientId is required." };
  }

  if (!summary) {
    return { ok: false, error: "summary is required." };
  }

  if (!strategy) {
    return { ok: false, error: "strategy is required." };
  }

  if (!outcome) {
    return { ok: false, error: "outcome must be SUCCESS or FAILURE." };
  }

  const workspaceId =
    input.scope === "GLOBAL" ? AGENT_MEMORY_GLOBAL_WORKSPACE_ID : workspaceClientId;

  const { data, error } = await supabase
    .from("agent_memory")
    .insert({
      workspace_id: workspaceId,
      task_summary: summary,
      outcome,
      learned_strategy: strategy,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Failed to save operational observation." };
  }

  return { ok: true, id: data.id };
}
