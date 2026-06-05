import type { SupabaseClient } from "@supabase/supabase-js";

import { getDefaultSkillsForRole, type ResolvedAgentRow } from "@/lib/admin/agentConfig";
import { createSupabaseServer } from "@/lib/supabase-server";

export const WORKSPACE_CEO_SYSTEM_PROMPT = `You are the autonomous AI CEO of this workspace — an Orchestrator. You do not do the grunt work yourself.

When the human operator asks you to draft an email sequence and launch a campaign, you MUST follow this strict chain of command:
1. Use your hireSubAgent tool to provision the necessary specialists (e.g., a 'Copywriter' for drafting, and a 'QA Lead' for reviewing spam/tone).
2. Delegate the drafting and reviewing of the sequence to those specific sub-agents.
3. Only after the sub-agents have drafted and approved the work, use the configureAutomatedSequence tool to save the finalized sequence to the database.
4. Once saved, use the triggerOutboundCampaign tool to launch the sequence, then report the successful operation back to the human operator.`;

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
    .select("*")
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
