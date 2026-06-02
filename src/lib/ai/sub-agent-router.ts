import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

import { deepseek } from "./providers";

type SubAgentRow = {
  id: string;
  role: string;
  name?: string | null;
  system_prompt: string;
};

const COPYWRITER_DEPRECATION_RULE = `CRITICAL: The save_draft_email chat bypass is DEPRECATED. You cannot write to the Human Review Queue directly. If asked to draft or queue an email, refuse and tell the CEO to run build_and_run_automation so copy flows through deepseek_llm -> copy_reviewer (Deliverability Chief) -> approval_gate.`;

function isCopywriterAgent(agent: SubAgentRow): boolean {
  const role = agent.role?.trim().toUpperCase();
  const name = agent.name?.trim().toLowerCase();
  return role === "COPYWRITER" || name === "halton_writer";
}

function subAgentTools(
  clientId: string,
  executionId: string,
  agent: SubAgentRow,
) {
  const agentId = agent.id;

  if (isCopywriterAgent(agent)) {
    return {};
  }

  return createResearchTools(clientId, executionId, agent.id);
}

function createResearchTools(clientId: string, executionId: string, agentId: string) {
  return {
    apollo_search_leads: tool({
      description: "Searches the Apollo B2B database for verified leads based on ICP.",
      inputSchema: z.object({
        jobTitles: z.array(z.string()),
        industry: z.string(),
        limit: z.number().default(5),
      }),
      execute: async (args) => {
        await supabase.from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_CALL",
          payload: { tool: "apollo_search_leads", args },
        });

        const { data: client } = await supabase
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

        const realLeads = people.map((person: any) => ({
          name: `${person.first_name} ${person.last_name}`.trim(),
          title: person.title,
          company: person.organization?.name || "Unknown Company",
          email: person.email || "No email found",
        }));

        const result = realLeads.slice(0, args.limit ?? 5);

        const leadsToInsert = result.map((lead) => ({
          client_id: clientId,
          prospect_name: lead.name,
          target_role: lead.title ?? null,
          target_company: lead.company,
          email: lead.email && lead.email !== "No email found" ? lead.email : null,
          // Apollo search often doesn't reveal verified emails; we stage these for later enrichment.
          email_status: lead.email && lead.email !== "No email found" ? "VERIFIED" : "RISKY",
          enrichment_status: "PENDING_SCRAPE",
        }));

        const { error: leadsError } = await supabase.from("leads").insert(leadsToInsert);
        if (leadsError) {
          console.error("Failed to persist leads:", leadsError);
        }

        await supabase.from("agent_logs").insert({
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
        await supabase.from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_CALL",
          payload: { tool: "firecrawl_scrape_url", args },
        });

        const { data: client } = await supabase
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

        await supabase.from("agent_logs").insert({
          execution_id: executionId,
          client_id: clientId,
          agent_id: agentId,
          event_type: "TOOL_RESULT",
          payload: { status: "SUCCESS", length: safeMarkdown.length },
        });

        return safeMarkdown;
      },
    }),
  };
}

export async function executeSubAgent(
  role: string,
  task: string,
  clientId: string,
  executionId: string,
): Promise<string> {
  const { data: subAgent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("role", role)
    .single();

  if (error || !subAgent) {
    throw new Error(`CRITICAL: ${role} Agent offline.`);
  }

  const agent = subAgent as SubAgentRow;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error("CRITICAL: Client context not found.");
  }

  const clientRow = client as ClientRow;

  const clientContext = `
--- ACTIVE WORKSPACE CONTEXT ---
COMPANY: ${clientRow.company_name ?? ""}
CORE OFFER: ${clientRow.core_offer ?? ""}
TARGET ICP: ${clientRow.target_icp ?? ""}
TONE OF VOICE: ${clientRow.tone_of_voice ?? ""}
CASE STUDIES: ${clientRow.case_studies ?? ""}

CRITICAL INSTRUCTION: You are operating strictly on behalf of this client. Base all decisions, delegations, and reasoning on the ACTIVE WORKSPACE CONTEXT.
`;

  let agentSpecificInstructions = "";
  if (isCopywriterAgent(agent)) {
    agentSpecificInstructions = COPYWRITER_DEPRECATION_RULE;
  }

  await supabase.from("agent_logs").insert({
    execution_id: executionId,
    client_id: clientId,
    agent_id: agent.id,
    event_type: "SPAWN",
    payload: { action: "WAKING_SUB_AGENT", task },
  });

  const response = await generateText({
    model: deepseek("deepseek-chat"),
    system: `${agent.system_prompt}\n\n${clientContext}\n\n${agentSpecificInstructions}`,
    prompt: `Execute this task: ${task}`,
    tools: subAgentTools(clientId, executionId, agent),
    stopWhen: stepCountIs(5),
  });

  await supabase.from("agent_logs").insert({
    execution_id: executionId,
    client_id: clientId,
    agent_id: agent.id,
    event_type: "THOUGHT",
    payload: { thought: response.text },
  });

  return response.text;
}
