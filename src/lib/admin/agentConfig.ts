import { supabase } from "@/lib/supabase";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

export type AgentSkillScope = "ceo" | "sub_agent";

export type AgentSkillDefinition = {
  id: string;
  label: string;
  description: string;
  scopes: AgentSkillScope[];
};

export const AGENT_SKILL_DEFINITIONS: AgentSkillDefinition[] = [
  {
    id: "read_knowledge_vault",
    label: "Read Knowledge Vault",
    description: "Search case studies, offers, and brand voice for the active workspace.",
    scopes: ["ceo"],
  },
  {
    id: "write_knowledge_vault",
    label: "Write Knowledge Vault",
    description: "Save cleaned notes and assets into the client knowledge vault.",
    scopes: ["ceo"],
  },
  {
    id: "build_automation",
    label: "Build & Run Automation",
    description: "Create and execute outbound DAG workflows (Human Review Queue path).",
    scopes: ["ceo"],
  },
  {
    id: "delegate_sub_agent",
    label: "Delegate Sub-Agents",
    description: "Spawn specialist agents from the live roster.",
    scopes: ["ceo"],
  },
  {
    id: "hire_sub_agent",
    label: "Hire Sub-Agents",
    description: "Dynamically create specialized sub-agents for the workspace.",
    scopes: ["ceo"],
  },
  {
    id: "trigger_outbound_campaign",
    label: "Trigger Outbound Campaign",
    description: "Launch the automated outbound sequence via cron.",
    scopes: ["ceo"],
  },
  {
    id: "configure_automated_sequence",
    label: "Configure Automated Sequence",
    description: "Save finalized email sequence steps to the workspace campaign.",
    scopes: ["ceo"],
  },
  {
    id: "log_operational_observation",
    label: "Log Operational Observation",
    description: "Persist learned lessons to agent memory for self-evolution.",
    scopes: ["ceo"],
  },
  {
    id: "web_search",
    label: "Web Search",
    description: "Scrape target URLs via Firecrawl for research tasks.",
    scopes: ["sub_agent"],
  },
  {
    id: "apollo_scrape",
    label: "Apollo Scrape",
    description: "Search Apollo for ICP-matched leads and stage them in the pipeline.",
    scopes: ["sub_agent"],
  },
];

const CEO_DEFAULT_SKILLS = [
  "read_knowledge_vault",
  "write_knowledge_vault",
  "build_automation",
  "delegate_sub_agent",
] as const;

const SUB_AGENT_DEFAULT_SKILLS = ["web_search", "apollo_scrape"] as const;

export function isCeoRole(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase() ?? "";
  return normalized === "CEO" || normalized === "CEO_ROUTER";
}

export function getSkillScopeForAgent(role: string | null | undefined): AgentSkillScope {
  return isCeoRole(role) ? "ceo" : "sub_agent";
}

export function getSkillsForAgentPanel(role: string | null | undefined): AgentSkillDefinition[] {
  const scope = getSkillScopeForAgent(role);
  return AGENT_SKILL_DEFINITIONS.filter((skill) => skill.scopes.includes(scope));
}

export function getDefaultSkillsForRole(role: string | null | undefined): string[] {
  if (isCeoRole(role)) {
    return [...CEO_DEFAULT_SKILLS];
  }
  return [...SUB_AGENT_DEFAULT_SKILLS];
}

export function normalizeSkills(raw: unknown, role: string | null | undefined): string[] {
  const allowed = new Set(getSkillsForAgentPanel(role).map((skill) => skill.id));
  const defaults = getDefaultSkillsForRole(role);

  let parsed: string[] = [];
  if (Array.isArray(raw)) {
    parsed = raw.filter((entry): entry is string => typeof entry === "string");
  }

  const source = parsed.length > 0 ? parsed : defaults;
  return source.filter((id) => allowed.has(id));
}

export type AgentConfigDraft = {
  name: string;
  system_prompt: string;
  is_active: boolean;
  skills: string[];
};

export function agentToConfigDraft(agent: AgentRosterRow): AgentConfigDraft {
  return {
    name: agent.name?.trim() ?? "",
    system_prompt: agent.system_prompt?.trim() ?? "",
    is_active: agent.is_active !== false,
    skills: normalizeSkills(agent.skills, agent.role),
  };
}

export type SaveAgentConfigResult = { ok: true; agentId: string } | { ok: false; error: string };

export async function saveAgentConfiguration(
  clientId: string,
  agent: AgentRosterRow,
  draft: AgentConfigDraft,
): Promise<SaveAgentConfigResult> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { ok: false, error: "No active workspace." };
  }

  const skills = normalizeSkills(draft.skills, agent.role);
  const payload = {
    name: draft.name.trim() || agent.name,
    system_prompt: draft.system_prompt,
    is_active: draft.is_active,
    skills,
  };

  if (isCeoRole(agent.role)) {
    let query = supabase.from("agents").update(payload).eq("id", agent.id);

    if (agent.client_id) {
      query = query.eq("client_id", workspaceClientId);
    }

    const { data, error } = await query.select("id").single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, agentId: data.id };
  }

  const isGlobal = !agent.client_id;

  if (isGlobal) {
    const { data: upserted, error: upsertError } = await supabase
      .from("agents")
      .upsert(
        {
          ...payload,
          role: agent.role,
          model: agent.model ?? "deepseek-chat",
          client_id: workspaceClientId,
        },
        { onConflict: "client_id,role" },
      )
      .select("id")
      .single();

    if (upsertError) {
      return { ok: false, error: upsertError.message };
    }

    return { ok: true, agentId: upserted.id };
  }

  let query = supabase.from("agents").update(payload).eq("id", agent.id);

  if (agent.client_id) {
    query = query.eq("client_id", workspaceClientId);
  }

  const { data, error } = await query.select("id").single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, agentId: data.id };
}

/** Maps configured skill ids to sub-agent tool keys used at runtime. */
export const SUB_AGENT_SKILL_TOOL_MAP: Record<string, keyof SubAgentToolSet> = {
  apollo_scrape: "apollo_search_leads",
  web_search: "firecrawl_scrape_url",
};

export type SubAgentToolSet = {
  apollo_search_leads?: unknown;
  firecrawl_scrape_url?: unknown;
};

export function filterSubAgentTools<T extends SubAgentToolSet>(
  tools: T,
  enabledSkills: string[],
): Partial<T> {
  const enabled = new Set(enabledSkills);
  const filtered = {} as Partial<T>;

  for (const [skillId, toolKey] of Object.entries(SUB_AGENT_SKILL_TOOL_MAP)) {
    if (!enabled.has(skillId)) continue;
    const tool = tools[toolKey];
    if (tool !== undefined) {
      filtered[toolKey] = tool;
    }
  }

  return filtered;
}

const CEO_SKILL_TOOL_MAP: Record<string, string> = {
  delegate_sub_agent: "spawn_sub_agent",
  read_knowledge_vault: "search_client_knowledge",
  write_knowledge_vault: "save_to_knowledge_vault",
  build_automation: "build_and_run_automation",
  hire_sub_agent: "hireSubAgent",
  trigger_outbound_campaign: "triggerOutboundCampaign",
  configure_automated_sequence: "configureAutomatedSequence",
  log_operational_observation: "logOperationalObservation",
};

export type ResolvedAgentRow = {
  id: string;
  role: string;
  name?: string | null;
  model?: string | null;
  system_prompt: string;
  skills?: unknown;
  is_active?: boolean | null;
  client_id?: string | null;
};

export async function resolveAgentForWorkspace(
  role: string,
  clientId: string,
): Promise<{ agent: ResolvedAgentRow | null; error?: string }> {
  const normalized = role.trim().toUpperCase().replace(/\s+/g, "_");
  const workspaceClientId = clientId.trim();

  if (!normalized) {
    return { agent: null, error: "Agent role is required." };
  }

  if (normalized === "CEO" && workspaceClientId) {
    const { data: ceo, error: ceoError } = await supabase
      .from("agents")
      .select("*")
      .eq("role", "CEO")
      .eq("client_id", workspaceClientId)
      .maybeSingle();

    if (ceoError) {
      return { agent: null, error: ceoError.message };
    }

    if (!ceo) {
      return { agent: null, error: "No workspace CEO provisioned." };
    }

    if (ceo.is_active === false) {
      return { agent: null, error: "CEO is inactive in this workspace." };
    }

    return { agent: ceo as ResolvedAgentRow };
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

export function filterCeoTools<T extends Record<string, unknown>>(
  tools: T,
  enabledSkills: string[],
): Partial<T> {
  const enabled = new Set(enabledSkills);
  const filtered = {} as Partial<T>;

  for (const [skillId, toolKey] of Object.entries(CEO_SKILL_TOOL_MAP)) {
    if (!enabled.has(skillId)) continue;
    const tool = tools[toolKey];
    if (tool !== undefined) {
      filtered[toolKey as keyof T] = tool as T[keyof T];
    }
  }

  return filtered;
}
