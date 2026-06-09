export type CoreToolScope = "ceo" | "sub_agent";
export type CoreToolRiskTier = "low" | "medium" | "high";

export type CoreToolDefinition = {
  id: string;
  label: string;
  description: string;
  runtimeToolKey: string;
  scope: CoreToolScope;
  riskTier: CoreToolRiskTier;
  /** Alternate ids accepted in assigned_tools[] (normalized to canonical id). */
  aliases?: string[];
};

export const CORE_SUB_AGENT_TOOLS: CoreToolDefinition[] = [
  {
    id: "web_search",
    label: "Web Search",
    description: "Scrape target URLs via Firecrawl and return markdown research briefs.",
    runtimeToolKey: "firecrawl_scrape_url",
    scope: "sub_agent",
    riskTier: "low",
    aliases: ["url_scraper", "firecrawl_scrape_url"],
  },
  {
    id: "apollo_scrape",
    label: "Apollo Lead Search",
    description: "Search Apollo.io for ICP-matched leads and stage them in the pipeline.",
    runtimeToolKey: "apollo_search_leads",
    scope: "sub_agent",
    riskTier: "medium",
    aliases: ["apollo_search_leads"],
  },
  {
    id: "fetch_crm_lead",
    label: "Fetch CRM Lead",
    description: "Search workspace leads by name, email, or company.",
    runtimeToolKey: "fetch_crm_lead",
    scope: "sub_agent",
    riskTier: "low",
  },
];

const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const tool of CORE_SUB_AGENT_TOOLS) {
  ALIAS_TO_CANONICAL.set(tool.id.toLowerCase(), tool.id);
  ALIAS_TO_CANONICAL.set(tool.runtimeToolKey.toLowerCase(), tool.id);
  for (const alias of tool.aliases ?? []) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), tool.id);
  }
}

const CANONICAL_IDS = new Set(CORE_SUB_AGENT_TOOLS.map((tool) => tool.id));

export function getCoreSubAgentToolById(id: string): CoreToolDefinition | undefined {
  const canonical = ALIAS_TO_CANONICAL.get(id.trim().toLowerCase());
  if (!canonical) return undefined;
  return CORE_SUB_AGENT_TOOLS.find((tool) => tool.id === canonical);
}

/** Normalize aliases to canonical registry ids; throws on unknown tools. */
export function validateAssignedTools(assigned: string[]): string[] {
  if (!Array.isArray(assigned) || assigned.length === 0) {
    throw new Error("assigned_tools must include at least one tool.");
  }

  const normalized: string[] = [];
  const unknown: string[] = [];

  for (const raw of assigned) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const canonical = ALIAS_TO_CANONICAL.get(trimmed.toLowerCase());
    if (!canonical) {
      unknown.push(trimmed);
      continue;
    }
    normalized.push(canonical);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown tool(s): ${unknown.join(", ")}. Available: ${[...CANONICAL_IDS].join(", ")}.`,
    );
  }

  if (normalized.length === 0) {
    throw new Error("assigned_tools must include at least one valid tool.");
  }

  return [...new Set(normalized)];
}

export function normalizeAssignedSubAgentTools(assigned: string[]): {
  skills: string[];
  tool_bindings: string[];
} {
  const canonicalIds = validateAssignedTools(assigned);
  const skills = [...canonicalIds];
  const tool_bindings = [
    ...new Set(
      canonicalIds.map((id) => {
        const def = CORE_SUB_AGENT_TOOLS.find((tool) => tool.id === id);
        return def?.runtimeToolKey ?? id;
      }),
    ),
  ];

  return { skills, tool_bindings };
}

/** Skill id → runtime tool key map derived from the registry (single source of truth). */
export const SUB_AGENT_SKILL_TOOL_MAP: Record<string, string> = Object.fromEntries(
  CORE_SUB_AGENT_TOOLS.map((tool) => [tool.id, tool.runtimeToolKey]),
);

export function formatCoreToolRegistryForCeo(): string {
  const lines = CORE_SUB_AGENT_TOOLS.map((tool) => {
    const aliasNote =
      tool.aliases && tool.aliases.length > 0
        ? ` (aliases: ${tool.aliases.join(", ")})`
        : "";
    return `- **${tool.id}** — ${tool.description} [risk: ${tool.riskTier}]${aliasNote}`;
  });

  return [
    "### SUB-AGENT TOOL REGISTRY (for hireSubAgent assigned_tools)",
    "When hiring specialists, pass canonical tool ids in assigned_tools (minimum 1):",
    ...lines,
  ].join("\n");
}

export function generateDynamicAgentRoleSlug(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `SPEC_${suffix}`;
}

export function isDynamicAgentRole(role: string | null | undefined): boolean {
  return (role?.trim().toUpperCase() ?? "").startsWith("SPEC_");
}
