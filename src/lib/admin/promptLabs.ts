export type SystemAgent = {
  id: string;
  label: string;
  active: boolean;
};

export const SYSTEM_AGENTS: SystemAgent[] = [
  { id: "scraper", label: "SCRAPER_ENGINE", active: true },
  { id: "condenser", label: "CONTEXT_CONDENSER", active: true },
  { id: "email", label: "EMAIL_ARCHITECT", active: true },
];

export const MERGE_VARIABLES = [
  "{{prospect_name}}",
  "{{company_name}}",
  "{{company_scraped_about}}",
  "{{target_role}}",
] as const;

export const DEFAULT_SYSTEM_PROMPT = `You are the EMAIL_ARCHITECT for Halton Works. Your objective is to write a 3-sentence email to {{prospect_name}} regarding their role as {{target_role}}. Use the following scraped insight to ground your hook: {{company_scraped_about}}. Never use words like 'synergy', 'revolutionize', or 'hope this finds you well'.`;

export const AGENT_TOOLS = [
  { id: "apollo_lead_discovery", label: "apollo_lead_discovery" },
  { id: "firecrawl_deep_scrape", label: "firecrawl_deep_scrape" },
  { id: "instantly_draft_payload", label: "instantly_draft_payload" },
  { id: "web_search_tavily", label: "web_search_tavily" },
] as const;

export type AgentToolId = (typeof AGENT_TOOLS)[number]["id"];

/** Default Vercel AI SDK tool assignments per agent profile. */
export const AGENT_DEFAULT_TOOLS: Record<string, AgentToolId[]> = {
  scraper: ["firecrawl_deep_scrape"],
  condenser: ["web_search_tavily"],
  email: ["apollo_lead_discovery", "instantly_draft_payload"],
};

export function getDefaultToolsForAgent(agentId: string): Set<AgentToolId> {
  return new Set(AGENT_DEFAULT_TOOLS[agentId] ?? []);
}
