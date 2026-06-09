import {
  getDefaultSkillsForRole,
  isCeoRole,
  normalizeSkills,
  AGENT_SKILL_DEFINITIONS,
} from "@/lib/admin/agentConfig";
import {
  CORE_SUB_AGENT_TOOLS,
  type CoreToolDefinition,
} from "@/lib/ai/coreToolRegistry";
import { supabase } from "@/lib/supabase";

export const AGENT_MODEL_OPTIONS = [
  { id: "deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  { id: "deepseek-v3", label: "DeepSeek V3" },
  { id: "gpt-4o", label: "GPT-4o (routes via DeepSeek vault)" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (routes via DeepSeek vault)" },
] as const;

export type GlobalToolDefinition = {
  id: string;
  label: string;
  description: string;
  category: "research" | "outbound" | "knowledge" | "orchestration";
};

const CEO_STUDIO_TOOLS: GlobalToolDefinition[] = AGENT_SKILL_DEFINITIONS.filter((skill) =>
  skill.scopes.includes("ceo"),
).map((skill) => ({
  id: skill.id,
  label: skill.label,
  description: skill.description,
  category: mapSkillToCategory(skill.id),
}));

function mapSkillToCategory(
  skillId: string,
): GlobalToolDefinition["category"] {
  if (skillId.includes("knowledge") || skillId.includes("vault")) return "knowledge";
  if (
    skillId.includes("automation") ||
    skillId.includes("outbound") ||
    skillId.includes("sequence")
  ) {
    return "outbound";
  }
  if (skillId.includes("alert") || skillId.includes("observation")) return "orchestration";
  return "orchestration";
}

function coreToolToStudioDefinition(tool: CoreToolDefinition): GlobalToolDefinition {
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    category: "research",
  };
}

export const SUB_AGENT_STUDIO_TOOLS: GlobalToolDefinition[] =
  CORE_SUB_AGENT_TOOLS.map(coreToolToStudioDefinition);

/** Combined registry for validation — CEO skills + sub-agent core tools. */
export const GLOBAL_TOOL_REGISTRY: GlobalToolDefinition[] = [
  ...CEO_STUDIO_TOOLS,
  ...SUB_AGENT_STUDIO_TOOLS,
];

export function getStudioToolsForRole(role: string | null | undefined): GlobalToolDefinition[] {
  return isCeoRole(role) ? CEO_STUDIO_TOOLS : SUB_AGENT_STUDIO_TOOLS;
}

export type ReasoningConfig = {
  instructions?: string;
  max_tokens?: number;
  top_p?: number;
};

export type AgentStudioRow = {
  id: string;
  name: string | null;
  role: string | null;
  model: string | null;
  temperature: number | null;
  system_prompt: string | null;
  tool_bindings: unknown;
  skills: unknown;
  reasoning_config: unknown;
  is_active: boolean | null;
  client_id: string | null;
};

export type AgentStudioDraft = {
  name: string;
  model: string;
  temperature: number;
  system_prompt: string;
  tool_bindings: string[];
  reasoning_config: ReasoningConfig;
  is_active: boolean;
};

const STUDIO_SELECT =
  "id, name, role, model, temperature, system_prompt, tool_bindings, skills, reasoning_config, is_active, client_id" as const;

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

const REGISTRY_IDS = new Set(GLOBAL_TOOL_REGISTRY.map((tool) => tool.id));

export function normalizeToolBindings(raw: unknown): string[] {
  return parseStringArray(raw).filter((id) => REGISTRY_IDS.has(id));
}

export function normalizeReasoningConfig(raw: unknown): ReasoningConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const config: ReasoningConfig = {};

  if (typeof record.instructions === "string") {
    config.instructions = record.instructions;
  }

  if (typeof record.max_tokens === "number" && Number.isFinite(record.max_tokens)) {
    config.max_tokens = record.max_tokens;
  }

  if (typeof record.top_p === "number" && Number.isFinite(record.top_p)) {
    config.top_p = record.top_p;
  }

  return config;
}

export function getEffectiveToolBindings(agent: {
  tool_bindings?: unknown;
  skills?: unknown;
  role?: string | null;
}): string[] {
  const bindings = normalizeToolBindings(agent.tool_bindings);
  if (bindings.length > 0) return bindings;
  return normalizeSkills(agent.skills, agent.role);
}

export function agentToStudioDraft(agent: AgentStudioRow): AgentStudioDraft {
  const bindings = getEffectiveToolBindings(agent);
  const temperature =
    typeof agent.temperature === "number" && Number.isFinite(agent.temperature)
      ? agent.temperature
      : 0.7;

  return {
    name: agent.name?.trim() ?? "",
    model: agent.model?.trim() || "deepseek-chat",
    temperature: Math.min(2, Math.max(0, temperature)),
    system_prompt: agent.system_prompt?.trim() ?? "",
    tool_bindings: bindings.length > 0 ? bindings : getDefaultSkillsForRole(agent.role),
    reasoning_config: normalizeReasoningConfig(agent.reasoning_config),
    is_active: agent.is_active !== false,
  };
}

export async function fetchAgentForStudio(
  agentId: string,
  clientId: string,
): Promise<{ agent: AgentStudioRow } | { error: string }> {
  const id = agentId.trim();
  const workspaceClientId = clientId.trim();

  if (!id || !workspaceClientId) {
    return { error: "Agent id and workspace client id are required." };
  }

  const { data, error } = await supabase
    .from("agents")
    .select(STUDIO_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Agent not found." };
  }

  const agent = data as AgentStudioRow;

  if (agent.client_id && agent.client_id !== workspaceClientId) {
    return { error: "Agent does not belong to this workspace." };
  }

  return { agent };
}

export type SaveAgentStudioResult =
  | { ok: true; agentId: string }
  | { ok: false; error: string };

export async function saveAgentStudioConfig(
  clientId: string,
  agent: AgentStudioRow,
  draft: AgentStudioDraft,
): Promise<SaveAgentStudioResult> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { ok: false, error: "No active workspace." };
  }

  const tool_bindings = normalizeToolBindings(draft.tool_bindings);
  const skills = normalizeSkills(tool_bindings, agent.role);

  const payload = {
    name: draft.name.trim() || agent.name,
    model: draft.model.trim() || "deepseek-chat",
    temperature: Math.min(2, Math.max(0, draft.temperature)),
    system_prompt: draft.system_prompt,
    tool_bindings,
    skills,
    reasoning_config: normalizeReasoningConfig(draft.reasoning_config),
    is_active: draft.is_active,
  };

  if (isCeoRole(agent.role)) {
    let query = supabase.from("agents").update(payload).eq("id", agent.id);

    if (agent.client_id) {
      query = query.eq("client_id", workspaceClientId);
    }

    const { data, error } = await query.select("id").single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, agentId: data.id };
  }

  if (!agent.client_id) {
    const { data: upserted, error: upsertError } = await supabase
      .from("agents")
      .upsert(
        {
          ...payload,
          role: agent.role,
          client_id: workspaceClientId,
        },
        { onConflict: "client_id,role" },
      )
      .select("id")
      .single();

    if (upsertError) return { ok: false, error: upsertError.message };
    return { ok: true, agentId: upserted.id };
  }

  const { data, error } = await supabase
    .from("agents")
    .update(payload)
    .eq("id", agent.id)
    .eq("client_id", workspaceClientId)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, agentId: data.id };
}
