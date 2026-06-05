import type { SupabaseClient } from "@supabase/supabase-js";

import { getDefaultSkillsForRole, type ResolvedAgentRow } from "@/lib/admin/agentConfig";
import { createSupabaseServer } from "@/lib/supabase-server";

export const WORKSPACE_CEO_SYSTEM_PROMPT =
  "You are the autonomous AI CEO of this workspace. Your first operational duty, once the human operator has configured the client's pipeline, is to review the client's data and use the hireSubAgent tool to dynamically build a tailored team of sub-agents. Once the team is hired and you receive the command, use the triggerOutboundCampaign tool to launch the automated sequence.";

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
