import type { SupabaseClient } from "@supabase/supabase-js";

import { getDefaultSkillsForRole, type ResolvedAgentRow } from "@/lib/admin/agentConfig";
import { createSupabaseServer } from "@/lib/supabase-server";

/** Default seed for newly provisioned workspace CEOs — editable via Agent Studio (`agents.system_prompt`). */
export const WORKSPACE_CEO_SYSTEM_PROMPT = `You are the autonomous AI CEO of this workspace — a Master Orchestrator. Your fundamental purpose is to analyze human operator commands, break them into operational steps, and manage a swarm of sub-agents to execute them. You do not do the grunt work yourself.

CRITICAL OPERATIONAL RULES:

Tool Discovery: You have access to a set of system tools. If the human operator requests a task for which you have a new, relevant tool, identify it and use it.

Assemble the Swarm: Always use your hireSubAgent tool to provision the specific specialists needed for the task (e.g., Copywriters, QA Leads, Data Analysts).

Delegate & Supervise: Delegate the drafting, reviewing, or data processing entirely to your sub-agents.

Self-Evolution: Before every mission, review your OPERATIONAL MEMORY (Global & Local) to identify past successes or failures. If a task failed previously, do not repeat it; use the identified learned_strategy to pivot immediately. After every mission, use logOperationalObservation to record your findings.

Lock & Execute: Only after the sub-agents have completed and approved their work should you use your system tools (like configureAutomatedSequence or triggerOutboundCampaign) to commit the final data to the system.

Report: Once the operation is live, report the successful execution back to the human operator.`;

export type CeoRuntimeContext = {
  operationalMemorySection: string;
  rosterText: string;
  clientContext: string;
  knowledgeVaultDirective: string;
  emailDagDirective: string;
};

export function resolveCeoSystemPrompt(dbPrompt: string | null | undefined): string {
  const trimmed = dbPrompt?.trim();
  return trimmed || WORKSPACE_CEO_SYSTEM_PROMPT;
}

/** Builds the LLM system message: Agent Studio prompt + per-request runtime context. */
export function buildCeoLlmSystemMessage(
  dbSystemPrompt: string | null | undefined,
  runtime: CeoRuntimeContext,
): string {
  const corePrompt = resolveCeoSystemPrompt(dbSystemPrompt);

  return `${corePrompt}

### OPERATIONAL MEMORY (LEARNED LESSONS)
${runtime.operationalMemorySection}

Here is your current roster of specialized sub-agents you can delegate to:
${runtime.rosterText}

When delegating, use the exact Role name.

${runtime.knowledgeVaultDirective}

${runtime.emailDagDirective}

${runtime.clientContext}`;
}

/** Workspace-bound CEO only — never falls back to a global template. */
export async function fetchWorkspaceCeoAgent(
  workspaceId: string,
  admin?: SupabaseClient,
): Promise<{ agent: ResolvedAgentRow | null; error?: string }> {
  const supabase = admin ?? createSupabaseServer();
  const scopedWorkspaceId = workspaceId.trim();

  if (!scopedWorkspaceId) {
    return { agent: null, error: "workspaceId is required." };
  }

  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, name, role, model, system_prompt, skills, tool_bindings, is_active, client_id, temperature, reasoning_config",
    )
    .eq("role", "CEO")
    .eq("client_id", scopedWorkspaceId)
    .maybeSingle();

  if (error) {
    return { agent: null, error: error.message };
  }

  if (!data) {
    return { agent: null, error: "No workspace CEO provisioned." };
  }

  if (data.is_active === false) {
    return { agent: null, error: "CEO is inactive in this workspace." };
  }

  return { agent: data as ResolvedAgentRow };
}

export async function resolveAgentForWorkspaceServer(
  role: string,
  clientId: string,
  admin?: SupabaseClient,
): Promise<{ agent: ResolvedAgentRow | null; error?: string }> {
  const supabase = admin ?? createSupabaseServer();
  const normalized = role.trim().toUpperCase().replace(/\s+/g, "_");
  const workspaceClientId = clientId.trim();

  if (!normalized) {
    return { agent: null, error: "Agent role is required." };
  }

  if (normalized === "CEO") {
    return fetchWorkspaceCeoAgent(workspaceClientId, supabase);
  }

  if (workspaceClientId) {
    const { data: scoped, error: scopedError } = await supabase
      .from("agents")
      .select("*")
      .eq("role", normalized)
      .eq("client_id", workspaceClientId)
      .maybeSingle();

    if (scopedError) {
      return { agent: null, error: scopedError.message };
    }

    if (scoped) {
      if (scoped.is_active === false) {
        return { agent: null, error: `${normalized} is inactive in this workspace.` };
      }
      return { agent: scoped as ResolvedAgentRow };
    }
  }

  const { data: global, error: globalError } = await supabase
    .from("agents")
    .select("*")
    .eq("role", normalized)
    .is("client_id", null)
    .maybeSingle();

  if (globalError) {
    return { agent: null, error: globalError.message };
  }

  if (!global) {
    return { agent: null, error: `CRITICAL: ${normalized} Agent offline.` };
  }

  if (global.is_active === false) {
    return { agent: null, error: `${normalized} is inactive.` };
  }

  return { agent: global as ResolvedAgentRow };
}

export type ProvisionWorkspaceCeoResult =
  | { ok: true; agentId: string; created: boolean }
  | { ok: false; error: string };

export async function provisionWorkspaceCeoAgent(
  clientId: string,
  admin?: SupabaseClient,
): Promise<ProvisionWorkspaceCeoResult> {
  const supabase = admin ?? createSupabaseServer();
  const workspaceClientId = clientId.trim();

  if (!workspaceClientId) {
    return { ok: false, error: "clientId is required." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("agents")
    .select("id")
    .eq("role", "CEO")
    .eq("client_id", workspaceClientId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  if (existing?.id) {
    return { ok: true, agentId: existing.id, created: false };
  }

  const skills = getDefaultSkillsForRole("CEO");

  const { data, error } = await supabase
    .from("agents")
    .insert({
      name: "Workspace CEO",
      role: "CEO",
      model: "deepseek-chat",
      system_prompt: WORKSPACE_CEO_SYSTEM_PROMPT,
      client_id: workspaceClientId,
      skills,
      tool_bindings: skills,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Failed to provision workspace CEO." };
  }

  return { ok: true, agentId: data.id, created: true };
}

/** Loads the latest CEO `agents.system_prompt` from the database before each LLM call. */
export async function fetchWorkspaceCeoSystemPrompt(
  workspaceId: string,
  admin?: SupabaseClient,
): Promise<{ systemPrompt: string | null; error?: string }> {
  const resolved = await fetchWorkspaceCeoAgent(workspaceId, admin);
  if (!resolved.agent) {
    return { systemPrompt: null, error: resolved.error };
  }

  return { systemPrompt: resolved.agent.system_prompt ?? null };
}
