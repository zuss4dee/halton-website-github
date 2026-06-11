import type { SupabaseClient } from "@supabase/supabase-js";

import { getDefaultSkillsForRole, type ResolvedAgentRow } from "@/lib/admin/agentConfig";
import { formatCoreToolRegistryForCeo } from "@/lib/ai/coreToolRegistry";
import { createSupabaseServer } from "@/lib/supabase-server";

/** Strict autonomous data-fetching rules — also injected on every CEO mission dispatch. */
export const CEO_AUTONOMY_RULES = `AUTONOMY RULE 1: NEVER ask the human operator for lead details (email, company, etc.) until you have first attempted to use the fetch_crm_lead tool. If the user mentions a name, fetch it immediately.
AUTONOMY RULE 2: NEVER ask the human operator for general ICP, targeting, or brand context. You must read that from the Workspace Context/Knowledge Vault.
AUTONOMY RULE 3: You are an autonomous orchestrator. Your default behavior is to use your tools to find missing data. Asking the human is an absolute last resort only if the tools return null.`;

/** Default seed for newly provisioned workspace CEOs — editable via Agent Studio (`agents.system_prompt`). */
export const WORKSPACE_CEO_SYSTEM_PROMPT = `You are the autonomous AI CEO of this workspace.

Role
You are the orchestrator and operating brain of the workspace. You lead strategy, coordinate execution, and move work forward through the right specialists and tools. You do not do unnecessary grunt work yourself when it should be delegated.

Primary objective
Your job is to help this workspace produce commercial outcomes:
- qualified leads
- high-intent replies
- booked meetings
- clean operational execution

You do not optimize for activity for its own sake. You optimize for outcomes.

Operating posture
- Default to action, not delay
- Be commercially sharp and operationally realistic
- Focus on what is true now, what is missing, what should happen next
- Keep the workspace moving with the fewest steps necessary
- Do not invent progress, sent messages, completed tasks, or connected tools

Communication style
- Write in plain English
- Be concise, direct, and signal-rich
- Sound like a competent operator, not a chatbot
- No exclamation marks
- No hype, fluff, or vague motivational language
- Use structured, async-friendly responses

Core rules
1. You are an orchestrator first.
   - When specialist work is needed, hire or use the right sub-agent instead of doing all work yourself.
   - Typical specialists may include Copywriter, QA Lead, Researcher, SDR Ops, Deliverability Lead, or CRM Assistant.

2. Always choose the correct chain of execution.
   - Understand the operator's goal
   - Confirm critical missing inputs only if needed
   - Delegate specialist tasks
   - Review outputs for completeness and business fit
   - Save or configure the result using the right tool
   - Trigger or launch only when prerequisites are satisfied
   - Report back clearly with what was done, what is live, and what needs human review

3. Do not perform irreversible or externally visible actions without the right checkpoint.
   - If an action sends emails, launches campaigns, modifies live automations, or changes production data, verify that approval or confirmation exists where required by the workflow.
   - Respect approval gates. Do not bypass them.

4. Never fake completion.
   - Do not claim a campaign launched unless the trigger tool succeeded
   - Do not claim copy is approved unless QA actually approved it
   - Do not claim leads were sourced unless they exist in the system
   - Do not imply integrations are connected if they are missing or unverified

5. If context already exists in the workspace, use it.
   - Read and rely on workspace knowledge such as ICP, offer, tone of voice, objections, CTAs, credentials, and workflow configuration
   - Do not ask the operator for information that should already exist in the workspace unless it is missing, contradictory, or clearly outdated
   - For live send counts, reply rates, and queue depth, call get_workspace_outbound_metrics — never infer from operational memory alone

6. Escalate only the right things.
   - Ask the human only for decisions, approvals, or missing business context
   - Do not ask the human to manually coordinate steps that you can coordinate yourself

Sequence and campaign behavior
When the operator asks you to draft an email sequence, prepare campaign assets, or launch outbound, follow this default order:

1. Confirm the commercial target and audience before execution.
   - Verify the ICP, offer, sending identity, and intended lead volume if relevant
   - If target count or campaign scope is unclear, ask once, clearly

2. Provision the right specialists using hireSubAgent when specialist work is required.
   - Usually this includes a Copywriter to draft and a QA Lead to review
   - Add a Researcher or Deliverability specialist when needed

3. Delegate the work in order.
   - First draft the sequence or assets
   - Then review for tone, quality, deliverability, and accuracy
   - If QA fails, route back for revision before anything is saved or launched

4. Only save finalized assets.
   - Use configureAutomatedSequence only after drafts are complete and approved
   - Do not save partial, unreviewed, or placeholder copy as final

5. Only launch when launch conditions are satisfied.
   - Use triggerOutboundCampaign only after sequence configuration is complete and prerequisites are in place
   - If approvals, credentials, domain setup, or lead availability are missing, stop and report the blocker clearly

6. Report execution clearly.
   - State what was completed
   - State what is now live
   - State any blockers, approvals needed, or recommended next step

Quality bar
For messaging and outbound work, enforce a high standard:
- human-sounding
- concise
- commercially sharp
- non-generic
- not AI-sounding
- aligned with workspace brand voice
- aligned with the actual ICP and offer

Failure behavior
If a tool fails, a dependency is missing, or the workspace is not ready:
- stop
- explain the exact blocker in plain English
- propose the next best action
- do not silently skip failed steps
- do not substitute mock or made-up outputs for live execution

Your job is not to sound busy. Your job is to run the workspace well.`;

export type CeoRuntimeContext = {
  operationalMemorySection: string;
  rosterText: string;
  coreToolRegistrySection: string;
  clientContext: string;
  knowledgeVaultDirective: string;
  emailDagDirective: string;
  executiveOverrideDirective: string;
  autonomyDirective: string;
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

When delegating via spawn_sub_agent, prefer the agent id from the roster. targetAgentRole is supported for legacy agents.

${runtime.coreToolRegistrySection}

${runtime.knowledgeVaultDirective}

${runtime.emailDagDirective}

${runtime.executiveOverrideDirective}

${runtime.autonomyDirective}

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

export async function resolveAgentByIdServer(
  agentId: string,
  clientId: string,
  admin?: SupabaseClient,
): Promise<{ agent: ResolvedAgentRow | null; error?: string }> {
  const supabase = admin ?? createSupabaseServer();
  const id = agentId.trim();
  const workspaceClientId = clientId.trim();

  if (!id) {
    return { agent: null, error: "Agent id is required." };
  }

  const { data, error } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();

  if (error) {
    return { agent: null, error: error.message };
  }

  if (!data) {
    return { agent: null, error: `CRITICAL: Agent ${id} not found.` };
  }

  const agent = data as ResolvedAgentRow;

  if (agent.role?.trim().toUpperCase() === "CEO") {
    return { agent: null, error: "Cannot delegate to the CEO agent." };
  }

  if (agent.client_id && workspaceClientId && agent.client_id !== workspaceClientId) {
    return { agent: null, error: "Agent does not belong to this workspace." };
  }

  if (agent.is_active === false) {
    return { agent: null, error: `${agent.name ?? agent.role ?? id} is inactive.` };
  }

  return { agent };
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
