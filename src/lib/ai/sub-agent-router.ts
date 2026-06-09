import "server-only";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { filterSubAgentTools } from "@/lib/admin/agentConfig";
import { fetchCrmLeadsForWorkspace } from "@/lib/admin/fetchCrmLead";
import { getEffectiveToolBindings } from "@/lib/admin/agentStudio";
import {
  resolveAgentByIdServer,
  resolveAgentForWorkspaceServer,
} from "@/lib/admin/provisionWorkspaceCeo";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { getSupabaseServer } from "@/lib/supabase-server";

import { deepseek } from "./providers";

function getRuntimeDb() {
  return getSupabaseServer();
}

type SubAgentRow = {
  id: string;
  role: string;
  name?: string | null;
  model?: string | null;
  system_prompt: string;
  skills?: unknown;
  tool_bindings?: unknown;
  is_active?: boolean | null;
};

export type DynamicAgentConfig = {
  id?: string;
  name?: string | null;
  role?: string | null;
  model?: string | null;
  system_prompt: string;
  skills?: unknown;
  tool_bindings?: unknown;
};

const COPYWRITER_DEPRECATION_RULE = `CRITICAL: The save_draft_email chat bypass is DEPRECATED. You cannot write to the Human Review Queue directly. If asked to draft or queue an email, refuse and tell the CEO to run build_and_run_automation so copy flows through deepseek_llm -> copy_reviewer (Deliverability Chief) -> approval_gate.`;

function isCopywriterAgent(agent: Pick<SubAgentRow, "role" | "name">): boolean {
  const role = agent.role?.trim().toUpperCase();
  const name = agent.name?.trim().toLowerCase();
  return role === "COPYWRITER" || name === "halton_writer";
}

function subAgentTools(
  clientId: string,
  executionId: string,
  agent: Pick<SubAgentRow, "id" | "role" | "name" | "skills" | "tool_bindings">,
) {
  const agentId = agent.id;

  if (isCopywriterAgent(agent)) {
    return {};
  }

  const allTools = createSubAgentRuntimeTools(clientId, executionId, agentId);
  const enabledSkills = getEffectiveToolBindings(agent);
  return filterSubAgentTools(allTools, enabledSkills);
}

function createSubAgentRuntimeTools(clientId: string, executionId: string, agentId: string) {
  return {
    apollo_search_leads: tool({
      description: "Searches the Apollo B2B database for verified leads based on ICP.",
      inputSchema: z.object({
        jobTitles: z.array(z.string()),
        industry: z.string(),
        limit: z.number().default(5),
      }),
      execute: async (args) => {
        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_CALL",
          payload: { tool: "apollo_search_leads", args },
        });

        const { data: client } = await getRuntimeDb()
          .from("clients")
          .select("apollo_api_key")
          .eq("id", clientId)
          .single();

        const apolloApiKey =
          (client as { apollo_api_key?: string | null } | null)?.apollo_api_key ?? null;

        if (!apolloApiKey) {
          throw new Error("CRITICAL: Apollo API key is missing in the Infrastructure Vault.");
        }

        const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache",
            "x-api-key": apolloApiKey,
          },
          body: JSON.stringify({
            person_titles: args.jobTitles,
            q_keywords: args.industry,
            per_page: args.limit || 5,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Apollo API Error: ${response.status} - ${response.statusText}`,
          );
        }

        const apolloData = (await response.json().catch(() => null)) as
          | { people?: Array<Record<string, unknown>> }
          | null;

        const people = Array.isArray(apolloData?.people) ? apolloData.people : [];

        const realLeads = people.map((person: Record<string, unknown>) => ({
          name: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
          title: person.title,
          company:
            (person.organization as { name?: string } | undefined)?.name || "Unknown Company",
          email: person.email || "No email found",
        }));

        const result = realLeads.slice(0, args.limit ?? 5);

        const leadsToInsert = result.map((lead) => ({
          client_id: clientId,
          prospect_name: lead.name,
          target_role: lead.title ?? null,
          target_company: lead.company,
          email: lead.email && lead.email !== "No email found" ? lead.email : null,
          email_status: lead.email && lead.email !== "No email found" ? "VERIFIED" : "RISKY",
          enrichment_status: "PENDING_SCRAPE",
        }));

        const { error: leadsError } = await getRuntimeDb().from("leads").insert(leadsToInsert);
        if (leadsError) {
          console.error("Failed to persist leads:", leadsError);
        }

        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_RESULT",
          payload: { status: "SUCCESS", result },
        });

        return result;
      },
    }),

    firecrawl_scrape_url: tool({
      description:
        "Scrapes a target website URL and returns the raw markdown of their business offering.",
      inputSchema: z.object({
        url: z.string(),
      }),
      execute: async (args) => {
        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_CALL",
          payload: { tool: "firecrawl_scrape_url", args },
        });

        const { data: client } = await getRuntimeDb()
          .from("clients")
          .select("firecrawl_api_key")
          .eq("id", clientId)
          .single();

        const firecrawlApiKey =
          (client as { firecrawl_api_key?: string | null } | null)?.firecrawl_api_key ?? null;

        if (!firecrawlApiKey) {
          throw new Error("CRITICAL: Firecrawl API key is missing in the Infrastructure Vault.");
        }

        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url: args.url,
            formats: ["markdown"],
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Firecrawl API Error: ${response.status} - ${response.statusText}`,
          );
        }

        const scrapeData = (await response.json().catch(() => null)) as
          | { data?: { markdown?: string } }
          | null;

        const rawMarkdown = scrapeData?.data?.markdown || "No content found on this URL.";
        const safeMarkdown =
          rawMarkdown.slice(0, 2500) + (rawMarkdown.length > 2500 ? "\n\n...[TRUNCATED]" : "");

        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_RESULT",
          payload: { status: "SUCCESS", length: safeMarkdown.length },
        });

        return safeMarkdown;
      },
    }),

    fetch_crm_lead: tool({
      description:
        "Search the workspace Leads CRM by name, email, or company. Returns matching leads with contact details and status.",
      inputSchema: z.object({
        search_query: z
          .string()
          .describe("Lead name, email address, or company name to search for."),
      }),
      execute: async ({ search_query }) => {
        const query = search_query.trim();

        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_CALL",
          payload: { tool: "fetch_crm_lead", search_query: query },
        });

        const result = await fetchCrmLeadsForWorkspace(clientId, query);

        if ("error" in result) {
          await getRuntimeDb().from("agent_logs").insert({
            execution_id: executionId,
            client_id: clientId,
            agent_id: agentId,
            event_type: "TOOL_RESULT",
            payload: { status: "ERROR", tool: "fetch_crm_lead", message: result.error },
          });
          return JSON.stringify({ error: result.error, leads: [], count: 0 });
        }

        await getRuntimeDb().from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_RESULT",
          payload: {
            status: "SUCCESS",
            tool: "fetch_crm_lead",
            count: result.count,
            search_query: result.search_query,
          },
        });

        return JSON.stringify(result, null, 2);
      },
    }),
  };
}

async function loadClientContext(clientId: string): Promise<string> {
  const { data: client, error: clientError } = await getRuntimeDb()
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error("CRITICAL: Client context not found.");
  }

  const clientRow = client as ClientRow;

  return `
--- ACTIVE WORKSPACE CONTEXT ---
COMPANY: ${clientRow.company_name ?? ""}
CORE OFFER: ${clientRow.core_offer ?? ""}
TARGET ICP: ${clientRow.target_icp ?? ""}
TONE OF VOICE: ${clientRow.tone_of_voice ?? ""}
CASE STUDIES: ${clientRow.case_studies ?? ""}

CRITICAL INSTRUCTION: You are operating strictly on behalf of this client. Base all decisions, delegations, and reasoning on the ACTIVE WORKSPACE CONTEXT.
`;
}

export async function executeDynamicAgent(
  config: DynamicAgentConfig,
  task: string,
  clientId: string,
  executionId: string,
): Promise<string> {
  const agentRow: SubAgentRow = {
    id: config.id ?? "ephemeral",
    role: config.role?.trim().toUpperCase() ?? "EPHEMERAL",
    name: config.name ?? null,
    model: config.model ?? null,
    system_prompt: config.system_prompt,
    skills: config.skills,
    tool_bindings: config.tool_bindings,
  };

  const clientContext = await loadClientContext(clientId);

  let agentSpecificInstructions = "";
  if (isCopywriterAgent(agentRow)) {
    agentSpecificInstructions = COPYWRITER_DEPRECATION_RULE;
  }

  const logAgentId = config.id ?? null;

  const supabase = getRuntimeDb();

  await supabase.from("agent_logs").insert({
    execution_id: executionId,
    client_id: clientId,
    agent_id: logAgentId,
    event_type: "SPAWN",
    payload: {
      action: config.id ? "WAKING_SUB_AGENT" : "SPAWNING_EPHEMERAL_AGENT",
      task,
      role: agentRow.role,
      name: agentRow.name,
    },
  });

  const modelId = agentRow.model?.trim() || "deepseek-chat";

  try {
    const response = await generateText({
      model: deepseek(modelId),
      system: `${agentRow.system_prompt}\n\n${clientContext}\n\n${agentSpecificInstructions}`,
      prompt: `Execute this task: ${task}`,
      tools: subAgentTools(clientId, executionId, agentRow),
      stopWhen: stepCountIs(5),
    });

    await supabase.from("agent_logs").insert({
      execution_id: executionId,
      client_id: clientId,
      agent_id: logAgentId,
      event_type: "THOUGHT",
      payload: { thought: response.text },
    });

    return response.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sub-agent execution failed.";
    await supabase
      .from("agent_logs")
      .insert({
        execution_id: executionId,
        client_id: clientId,
        agent_id: logAgentId,
        event_type: "TOOL_RESULT",
        payload: { status: "ERROR", action: "SUB_AGENT_EXECUTION", message },
      })
      .catch(() => undefined);
    throw new Error(message);
  }
}

export async function executeSubAgentById(
  agentId: string,
  task: string,
  clientId: string,
  executionId: string,
): Promise<string> {
  const resolved = await resolveAgentByIdServer(agentId, clientId);
  if (!resolved.agent) {
    throw new Error(resolved.error ?? `CRITICAL: Agent ${agentId} offline.`);
  }

  const agent = resolved.agent;

  return executeDynamicAgent(
    {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      system_prompt: agent.system_prompt,
      skills: agent.skills,
      tool_bindings: agent.tool_bindings,
    },
    task,
    clientId,
    executionId,
  );
}

export async function executeSubAgent(
  role: string,
  task: string,
  clientId: string,
  executionId: string,
): Promise<string> {
  const resolved = await resolveAgentForWorkspaceServer(role, clientId);
  if (!resolved.agent) {
    throw new Error(resolved.error ?? `CRITICAL: ${role} Agent offline.`);
  }

  const agent = resolved.agent;

  return executeDynamicAgent(
    {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      system_prompt: agent.system_prompt,
      skills: agent.skills,
      tool_bindings: agent.tool_bindings,
    },
    task,
    clientId,
    executionId,
  );
}
