import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import type { ClientRow } from "@/lib/admin/clientsRepository";

import {
  buildDeliverabilityChiefSystemPrompt,
  DELIVERABILITY_CHIEF_ROLE,
} from "@/lib/admin/deliverabilityChiefPrompt";
import { normalizeAutomationGraph } from "@/lib/admin/automationGraphNormalize";
import {
  KNOWLEDGE_CATEGORIES,
  VAULT_SAVE_CATEGORIES,
  type KnowledgeCategory,
  type VaultSaveCategory,
} from "@/lib/admin/clientKnowledge";
import {
  resolveClientId,
  saveToKnowledgeVault,
  searchClientKnowledge,
} from "@/lib/admin/clientKnowledge.server";
import {
  fetchOperationalMemory,
  formatOperationalMemorySection,
  logOperationalObservation as persistOperationalObservation,
} from "@/lib/admin/agentMemory";
import { alertHumanOperator } from "@/lib/tools/alerting";
import { invokeRunOutbound } from "@/lib/tools/automation";
import { upsertCampaignSequencesServer } from "@/lib/admin/campaignSequencesRepository";
import { filterCeoTools, getDefaultSkillsForRole } from "@/lib/admin/agentConfig";
import { buildCronAuthHeaders, getCronSecret } from "@/lib/cron/cronAuth";
import { processOutboundQueue } from "@/lib/cron/processOutbound";
import {
  formatCoreToolRegistryForCeo,
  generateDynamicAgentRoleSlug,
  normalizeAssignedSubAgentTools,
  validateAssignedTools,
} from "@/lib/ai/coreToolRegistry";
import {
  buildCeoLlmSystemMessage,
  CEO_AUTONOMY_RULES,
  fetchWorkspaceCeoAgent,
  fetchWorkspaceCeoSystemPrompt,
  resolveAgentByIdServer,
  resolveAgentForWorkspaceServer,
} from "@/lib/admin/provisionWorkspaceCeo";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getEffectiveToolBindings } from "@/lib/admin/agentStudio";
import { formatReplyContextForCeo, type TerminalReplyContext } from "@/lib/admin/terminalReply";
import { fetchCrmLeadsForWorkspace } from "@/lib/admin/fetchCrmLead";

import { deepseek } from "./providers";
import { executeDynamicAgent, executeSubAgent, executeSubAgentById } from "./sub-agent-router";

type CEOAgent = {
  id: string;
  role: string;
  system_prompt: string;
  skills?: unknown;
  tool_bindings?: unknown;
};

type AgentRosterRow = {
  id: string;
  name?: string | null;
  role: string;
  system_prompt: string;
  skills?: unknown;
  tool_bindings?: unknown;
};

function formatRosterTools(agent: AgentRosterRow): string {
  const bindings = getEffectiveToolBindings(agent);
  return bindings.length > 0 ? bindings.join(", ") : "none";
}

export type CEOCommandResult = {
  executionId: string;
  text: string;
};

function summarizePrompt(systemPrompt: string): string {
  const normalized = systemPrompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "No description provided.";
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function resolveCronBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

function logInsert(
  executionId: string,
  clientId: string,
  agentId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return getSupabaseServer().from("agent_logs").insert({
    execution_id: executionId,
    client_id: clientId,
    agent_id: agentId,
    event_type: eventType,
    payload,
  });
}

export async function executeCEOCommand(
  userCommand: string,
  clientId: string,
  onBooted?: (executionId: string) => void | Promise<void>,
  replyContext?: TerminalReplyContext,
): Promise<CEOCommandResult> {
  const trimmed = userCommand.trim();
  if (!trimmed) {
    throw new Error("Command cannot be empty.");
  }

  const prompt = replyContext ? formatReplyContextForCeo(trimmed, replyContext) : trimmed;

  if (!clientId.trim()) {
    throw new Error("clientId is required.");
  }

  const executionId = crypto.randomUUID();
  const supabase = getSupabaseServer();

  const ceoResolved = await fetchWorkspaceCeoAgent(clientId);
  if (!ceoResolved.agent) {
    throw new Error(ceoResolved.error ?? "CRITICAL: Workspace CEO not provisioned.");
  }

  const ceo = ceoResolved.agent;

  const { data: rosterData, error: rosterError } = await supabase
    .from("agents")
    .select("id, name, role, system_prompt, skills, tool_bindings")
    .eq("client_id", clientId)
    .neq("role", "CEO");

  if (rosterError || !rosterData) {
    throw new Error("CRITICAL: Could not load agent roster.");
  }

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

  const ceoAgent = ceo as CEOAgent;
  const roster = (rosterData as AgentRosterRow[]).filter(
    (agent) => agent.role?.trim().toUpperCase() !== "CEO",
  );
  const rosterText =
    roster.length > 0
      ? roster
          .map((agent) => {
            const displayName = agent.name?.trim() || agent.role;
            return `- ${displayName} (id: ${agent.id}, role: ${agent.role}) | tools: ${formatRosterTools(agent)} — ${summarizePrompt(agent.system_prompt)}`;
          })
          .join("\n")
      : "- No specialized sub-agents currently registered.";
  const rosterRoles = roster.map((agent) => agent.role).filter(Boolean);
  const coreToolRegistrySection = formatCoreToolRegistryForCeo();

  const knowledgeVaultDirective = `
--- CLIENT KNOWLEDGE VAULT (RAG) ---
Before generating campaign workflows with build_and_run_automation, you MUST first call search_client_knowledge for the target clientId.
Use the returned case studies, core offers, and brand voice guidelines to ground all copy in real client facts.
When defining deepseek_llm node prompts inside build_and_run_automation, inject concrete performance milestones and wins from the knowledge search—never generic filler.
If knowledge is sparse, say so and use the ACTIVE WORKSPACE CONTEXT as fallback.
When the admin pastes raw notes, case study fragments, offer details, or brand tone guidance, use save_to_knowledge_vault to extract concrete facts, rewrite them professionally, and store them in the vault.
`;

  const emailDagDirective = `
--- OUTBOUND EMAIL (DAG ONLY — NO CHAT BYPASS) ---
To generate ANY email or queue copy for human review, you MUST use build_and_run_automation. The save_draft_email path is deprecated.
Do NOT delegate email drafting to COPYWRITER or any sub-agent to bypass the DAG.
Recommended pipeline: apollo_search (or trigger with CSV lead) -> agent_research (optional but required for personalized copy) -> deepseek_llm (label "DeepSeek Writer") -> copy_reviewer (type copy_reviewer, label "Deliverability Chief") -> approval_gate (queues sanitized body) -> resend_email (optional test send).
agent_research node: set data.url to {{steps.<apollo_id>.website}} (falls back to research_url / linkedin_url on the lead). Optional data.agentId from roster. Writer prompt MUST reference {{steps.<research_id>.brief}} — never hardcode industry-generic pain unless research is empty.
The 4th node in a 5-step Apollo campaign MUST be type copy_reviewer with data.label exactly "Deliverability Chief" — never "AI Writer".
approval_gate and resend_email MUST use data.body = {{steps.<reviewer_node_id>.copy}} only.
`;

  const executiveOverrideDirective = `
--- EXECUTIVE OVERRIDE (EXECUTIVE_OVERRIDE) ---
You are the ultimate authority. If a sub-agent repeatedly fails an instruction or violates a workspace context rule (formatting, tone, data handling), do not get stuck in an infinite loop.
Use execute_executive_override to halt the failing DAG step, inject your corrected_payload as the source of truth, and resume the pipeline through approval_gate (or resend when approved).
Parameters: node_id (failed step id from execution log), corrected_payload (your fixed copy/data), reason (why override was required), test_email (safemode recipient), prior_context (optional — pass the "Final context" JSON from the failed run to skip completed upstream steps).
When overriding copy_reviewer, your payload is treated as QA-approved and flows directly to approval_gate/resend.
`;

  const autonomyDirective = `
--- AUTONOMY & DATA FETCHING (STRICT) ---
${CEO_AUTONOMY_RULES}

--- OPERATOR PIPELINE OVERSIGHT ---
Human CSV injects and queue regenerates run the saved workflow directly for speed, but every outbound pipeline execution is logged to agent_logs (event OUTBOUND_PIPELINE) and agent_memory under this workspace. You are always notified via operational memory. Proactively review pending drafts in the Human Review Queue when memory shows new bulk_csv_inject or operator_regenerate runs.
`;

  await logInsert(executionId, clientId, ceoAgent.id, "SPAWN", {
    action: "INITIALIZING_ROUTER",
    command: trimmed,
    clientId,
    ...(replyContext ? { replyContext } : {}),
  });

  if (onBooted) {
    await onBooted(executionId);
  }

  const tools = {
    spawn_sub_agent: tool({
      description: `Delegate a focused task to a specialist sub-agent. Prefer agentId from the live roster. Legacy targetAgentRole also supported: ${rosterRoles.length > 0 ? rosterRoles.join(", ") : "No roles available yet"}.`,
      inputSchema: z
        .object({
          agentId: z
            .string()
            .optional()
            .describe("UUID of the sub-agent from the live roster (preferred)."),
          targetAgentRole: z
            .string()
            .optional()
            .describe("Exact role slug from the live roster (legacy fallback)."),
          specificTask: z.string().describe("The exact instruction for the sub-agent."),
        })
        .refine((data) => Boolean(data.agentId?.trim() || data.targetAgentRole?.trim()), {
          message: "Provide agentId or targetAgentRole.",
        }),
      execute: async ({ agentId, targetAgentRole, specificTask }) => {
        const normalizedTarget = targetAgentRole?.trim().toUpperCase() ?? "";
        const taskLooksLikeEmail =
          /email|draft|outreach|cold\s*email|review\s*queue|send\s*copy|write\s*copy/i.test(
            specificTask,
          );

        if (
          (normalizedTarget === "COPYWRITER" || normalizedTarget.includes("WRITER")) &&
          taskLooksLikeEmail
        ) {
          return [
            "BLOCKED: Email generation cannot use spawn_sub_agent / save_draft_email.",
            "Use build_and_run_automation so copy is sanitized by the Deliverability Chief before the Human Review Queue.",
          ].join(" ");
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "SPAWNING_AGENT",
          agentId: agentId?.trim() || null,
          target: targetAgentRole ?? null,
          task: specificTask,
        });

        let subAgentResult: string;

        try {
          if (agentId?.trim()) {
            const targetResolved = await resolveAgentByIdServer(agentId.trim(), clientId);
            if (!targetResolved.agent) {
              return targetResolved.error ?? `CRITICAL: Agent ${agentId} offline.`;
            }

            subAgentResult = await executeSubAgentById(
              agentId.trim(),
              specificTask,
              clientId,
              executionId,
            );
          } else {
            const role = targetAgentRole!.trim();
            const targetResolved = await resolveAgentForWorkspaceServer(role, clientId);
            if (!targetResolved.agent) {
              return targetResolved.error ?? `CRITICAL: ${role} Agent offline.`;
            }

            subAgentResult = await executeSubAgent(role, specificTask, clientId, executionId);
          }
        } catch (spawnError) {
          const message =
            spawnError instanceof Error ? spawnError.message : "Sub-agent execution failed.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "SPAWNING_AGENT",
            message,
          });
          return `TOOL_ERROR: ${message}`;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          result: subAgentResult,
        });

        return subAgentResult;
      },
    }),
    spawn_ephemeral_agent: tool({
      description:
        "Run a one-off specialist without persisting to the roster. Provide agent_name, dynamic_system_prompt, assigned_tools (min 1 from SUB-AGENT TOOL REGISTRY), and specificTask.",
      inputSchema: z.object({
        agent_name: z.string().describe("Display name for this ephemeral specialist."),
        dynamic_system_prompt: z
          .string()
          .describe("Full system prompt defining persona, rules, and output format."),
        assigned_tools: z
          .array(z.string())
          .min(1)
          .describe("Tool ids from the SUB-AGENT TOOL REGISTRY (e.g. web_search, apollo_scrape)."),
        specificTask: z.string().describe("The exact instruction for the ephemeral agent."),
        model: z.string().optional(),
      }),
      execute: async ({
        agent_name,
        dynamic_system_prompt,
        assigned_tools,
        specificTask,
        model,
      }) => {
        let normalizedTools: { skills: string[]; tool_bindings: string[] };
        try {
          normalizedTools = normalizeAssignedSubAgentTools(assigned_tools);
        } catch (validationError) {
          const message =
            validationError instanceof Error
              ? validationError.message
              : "Invalid assigned_tools.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "SPAWN_EPHEMERAL_AGENT",
            message,
          });
          return message;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "SPAWN_EPHEMERAL_AGENT",
          name: agent_name.trim(),
          assigned_tools: normalizedTools.skills,
          task: specificTask,
        });

        let subAgentResult: string;
        try {
          subAgentResult = await executeDynamicAgent(
            {
              name: agent_name.trim(),
              role: generateDynamicAgentRoleSlug(),
              model: model?.trim() || "deepseek-chat",
              system_prompt: dynamic_system_prompt,
              skills: normalizedTools.skills,
              tool_bindings: normalizedTools.tool_bindings,
            },
            specificTask,
            clientId,
            executionId,
          );
        } catch (spawnError) {
          const message =
            spawnError instanceof Error ? spawnError.message : "Ephemeral agent execution failed.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "SPAWN_EPHEMERAL_AGENT",
            message,
          });
          return `TOOL_ERROR: ${message}`;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "SPAWN_EPHEMERAL_AGENT",
          name: agent_name.trim(),
          result: subAgentResult,
        });

        return subAgentResult;
      },
    }),
    search_client_knowledge: tool({
      description:
        "Searches the database for case studies, core offers, and brand voice guidelines belonging to the specific client. Use this BEFORE generating campaign steps or writing emails to ground the copy in real-world facts and client history.",
      inputSchema: z.object({
        clientId: z.string(),
        category: z
          .enum(KNOWLEDGE_CATEGORIES)
          .optional()
          .describe(
            "Optional filter: case_study, brand_voice, or core_offer. Omit to search all categories.",
          ),
      }),
      execute: async ({ clientId: incomingClientId, category }) => {
        const resolved = await resolveClientId(incomingClientId);
        if ("error" in resolved) {
          return resolved.error;
        }

        const targetClientId = resolved.clientId;

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "SEARCH_CLIENT_KNOWLEDGE",
          targetClientId,
          category: category ?? null,
        });

        const result = await searchClientKnowledge(
          targetClientId,
          category as KnowledgeCategory | undefined,
        );

        if ("error" in result) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "SEARCH_CLIENT_KNOWLEDGE",
            message: result.error,
          });
          return result.error;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "SEARCH_CLIENT_KNOWLEDGE",
          entryCount: result.entryCount,
          categoryFilter: result.categoryFilter,
        });

        return result;
      },
    }),
    fetch_crm_lead: tool({
      description:
        "FETCH_CRM_LEAD: Search the workspace Leads CRM by name, email, or company. Returns matching leads with first name, last name, email, company, and status. Use before building outbound automations when the operator references a specific person.",
      inputSchema: z.object({
        search_query: z
          .string()
          .describe("Lead name, email address, or company name to search for."),
      }),
      execute: async ({ search_query }) => {
        const query = search_query.trim();

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "FETCH_CRM_LEAD",
          search_query: query,
        });

        const result = await fetchCrmLeadsForWorkspace(clientId, query);

        if ("error" in result) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "FETCH_CRM_LEAD",
            message: result.error,
          });
          return JSON.stringify({ error: result.error, leads: [], count: 0 });
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "FETCH_CRM_LEAD",
          count: result.count,
          search_query: result.search_query,
        });

        return JSON.stringify(result, null, 2);
      },
    }),
    save_to_knowledge_vault: tool({
      description:
        "Processes raw text, notes, or instructions from the admin, categorizes the information, and saves it into the client's knowledge vault. Use this when the admin pastes information about a client's past results, offers, or brand tone. When the admin provides messy text, extract concrete facts, rewrite them into a clean professional format (for case studies use Challenge / Solution / Result structure), assign the correct category, then save.",
      inputSchema: z.object({
        clientId: z.string().describe("Client UUID or slug."),
        title: z.string().describe("Clean, descriptive title for this knowledge asset."),
        content: z
          .string()
          .describe(
            "Cleaned-up professional version of the admin's raw text, ready for RAG retrieval.",
          ),
        category: z
          .enum(VAULT_SAVE_CATEGORIES)
          .describe("Strictly one of: case_study, core_offer, brand_voice, or general."),
      }),
      execute: async ({ clientId: incomingClientId, title, content, category }) => {
        const resolved = await resolveClientId(incomingClientId);
        if ("error" in resolved) {
          return resolved.error;
        }

        const targetClientId = resolved.clientId;
        const normalizedCategory = category as VaultSaveCategory;

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "SAVE_TO_KNOWLEDGE_VAULT",
          targetClientId,
          title,
          category: normalizedCategory,
        });

        const result = await saveToKnowledgeVault({
          clientId: targetClientId,
          title,
          content,
          category: normalizedCategory,
        });

        if ("error" in result) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "SAVE_TO_KNOWLEDGE_VAULT",
            message: result.error,
          });
          return result.error;
        }

        const categoryLabel = normalizedCategory.replace(/_/g, " ");
        const message = `Saved "${result.title}" to the knowledge vault under category "${categoryLabel}".`;

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "SAVE_TO_KNOWLEDGE_VAULT",
          entryId: result.id,
          category: result.category,
          title: result.title,
        });

        return message;
      },
    }),
    trigger_automation_sop: tool({
      description:
        "Triggers a saved visual automation workflow for a specific client. Use this whenever the admin asks you to 'run the campaign', 'launch the outbound flow', or 'trigger the automation'.",
      inputSchema: z.object({
        clientId: z.string(),
        testEmail: z.string().optional(),
      }),
      execute: async ({ clientId: incomingClientId, testEmail }) => {
        let targetClientId = incomingClientId;
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetClientId)
        ) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("id")
            .eq("slug", targetClientId)
            .single();

          if (clientError || !clientData) {
            return `Error: Could not find a client matching slug "${targetClientId}"`;
          }

          targetClientId = clientData.id;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "TRIGGER_AUTOMATION_SOP",
          targetClientId,
          testEmail: testEmail ?? null,
        });

        const { data: workflow, error: workflowError } = await supabase
          .from("workflows")
          .select("graph_json")
          .eq("client_id", targetClientId)
          .eq("is_active", true)
          .single();

        if (workflowError) {
          if (workflowError.code === "PGRST116") {
            const message =
              "No active workflow found for this client. Please draw one in the workflow builder.";
            await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
              status: "EMPTY",
              action: "TRIGGER_AUTOMATION_SOP",
              message,
            });
            return message;
          }
          const message = `Failed to load active workflow: ${workflowError.message}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_AUTOMATION_SOP",
            message,
          });
          return message;
        }

        const graph = workflow?.graph_json as
          | { nodes?: unknown[]; edges?: unknown[] }
          | null
          | undefined;
        const nodes = Array.isArray(graph?.nodes) ? graph.nodes : null;
        const edges = Array.isArray(graph?.edges) ? graph.edges : null;

        if (!nodes || !edges) {
          const message =
            "No active workflow found for this client. Please draw one in the workflow builder.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "EMPTY",
            action: "TRIGGER_AUTOMATION_SOP",
            message,
          });
          return message;
        }

        const runResult = await invokeRunOutbound({
          clientId: targetClientId,
          nodes,
          edges,
          ...(testEmail ? { testEmail } : {}),
        });

        if (!runResult.ok) {
          const message = `Workflow execution failed: ${runResult.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_AUTOMATION_SOP",
            message,
          });
          return message;
        }

        const runPayload = runResult.data;
        if (runPayload?.error) {
          const message = `Workflow execution failed: ${runPayload.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_AUTOMATION_SOP",
            message,
          });
          return message;
        }

        const executionLog = runPayload?.executionLog ?? [];
        const contextSummary = JSON.stringify(runPayload?.context ?? {}, null, 2);
        const executionLogSummary =
          executionLog.length > 0
            ? executionLog
                .map((entry, idx) => {
                  const stepType = entry.type ? ` (${entry.type})` : "";
                  return `${idx + 1}. ${entry.nodeId}${stepType} -> ${entry.status}`;
                })
                .join("\n")
            : "No execution steps returned.";

        const summaryText = [
          "Automation workflow execution complete.",
          "",
          "Execution log:",
          executionLogSummary,
          "",
          "Final context:",
          contextSummary,
        ].join("\n");

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "TRIGGER_AUTOMATION_SOP",
          summary: {
            success: Boolean(runPayload?.success),
            steps: executionLog.length,
            okSteps: executionLog.filter((entry) => entry.status === "ok").length,
          },
        });

        return summaryText;
      },
    }),
    build_and_run_automation: tool({
      description:
        'ONLY approved path for outbound email generation. Builds a workflow graph, saves the active SOP, and runs run-outbound. REQUIRED FIRST: search_client_knowledge. NEVER use spawn_sub_agent/COPYWRITER to queue emails. STRICT LABELS: every node needs data.label. deepseek_llm -> label exactly "DeepSeek Writer". copy_reviewer -> type MUST be copy_reviewer (NOT deepseek_llm) and label exactly "Deliverability Chief" (never "AI Writer"). Recommended Apollo campaign: (1) trigger, (2) apollo_search, (3) agent_research (data.url={{steps.<apollo_id>.website}}, optional data.agentId), (4) deepseek_llm (prompt uses {{steps.<research_id>.brief}}), (5) copy_reviewer, (6) approval_gate, (7) resend_email optional. STRICT WIRING: copy_reviewer data.draft = {{steps.<writer_id>.copy}}. approval_gate data.body AND resend_email data.body MUST be {{steps.<reviewer_id>.copy}} only. Unique ids (research-1, writer-1, reviewer-1, gate-1); linear edges.',
      inputSchema: z.object({
        clientId: z.string(),
        workflowName: z.string(),
        testEmail: z.string().optional(),
        nodes: z.array(
          z.object({
            id: z.string(),
            type: z.enum([
              "trigger",
              "apollo_search",
              "agent_research",
              "deepseek_llm",
              "copy_reviewer",
              "approval_gate",
              "resend_email",
            ]),
            data: z
              .record(z.string(), z.unknown())
              .describe(
                'Required. Must include label on every node. deepseek_llm label: "DeepSeek Writer". copy_reviewer label: "Deliverability Chief". Include prompt, draft, or body per type.',
              )
              .optional(),
          }),
        ),
        edges: z.array(
          z.object({
            id: z.string(),
            source: z.string(),
            target: z.string(),
          }),
        ),
      }),
      execute: async ({ clientId: incomingClientId, workflowName, testEmail, nodes, edges }) => {
        let targetClientId = incomingClientId;
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetClientId)
        ) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("id")
            .eq("slug", targetClientId)
            .single();

          if (clientError || !clientData) {
            return `Error: Could not find a client matching slug "${targetClientId}"`;
          }

          targetClientId = clientData.id;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "BUILD_AND_RUN_AUTOMATION",
          targetClientId,
          workflowName,
          testEmail: testEmail ?? null,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        });

        if (!testEmail?.trim()) {
          return "Please provide a testEmail so I can safely run this automation in safemode.";
        }

        const hasTriggerFirst = nodes[0]?.type === "trigger";
        if (!hasTriggerFirst) {
          return "The workflow is invalid: the first node must be a trigger node.";
        }

        const normalizedNodes = normalizeAutomationGraph(
          nodes.map((node) => ({
            id: node.id,
            type: node.type,
            data: node.data,
          })),
        );

        const reviewerNode = normalizedNodes.find((node) => node.type === "copy_reviewer");
        if (!reviewerNode) {
          return [
            "Workflow invalid: missing copy_reviewer node.",
            'Add a 4th-step node with type copy_reviewer and data.label "Deliverability Chief".',
          ].join(" ");
        }

        const laidOutNodes = normalizedNodes.map((node, index) => ({
          ...node,
          position: { x: 250, y: index * 150 },
        }));

        const graph = {
          nodes: laidOutNodes,
          edges,
        };

        const { error: upsertError } = await supabase.from("workflows").upsert(
          {
            client_id: targetClientId,
            name: workflowName,
            graph_json: graph,
            is_active: true,
          },
          { onConflict: "client_id" },
        );

        if (upsertError) {
          const message = `Failed to save workflow graph: ${upsertError.message}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "BUILD_AND_RUN_AUTOMATION",
            message,
          });
          return message;
        }

        const runResult = await invokeRunOutbound({
          clientId: targetClientId,
          nodes: laidOutNodes,
          edges,
          testEmail: testEmail.trim(),
        });

        if (!runResult.ok) {
          const message = `Workflow execution failed: ${runResult.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "BUILD_AND_RUN_AUTOMATION",
            message,
          });
          return message;
        }

        const runPayload = runResult.data;

        if (runPayload?.error) {
          const message = `Workflow execution failed: ${runPayload.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "BUILD_AND_RUN_AUTOMATION",
            message,
          });
          return message;
        }

        const executionLog = runPayload?.executionLog ?? [];
        const context = runPayload?.context ?? {};
        const contextRecord =
          typeof context === "object" && context !== null
            ? (context as Record<string, unknown>)
            : {};

        const resendEntries = Object.entries(contextRecord)
          .filter(([, value]) => {
            if (!value || typeof value !== "object") return false;
            return "messageId" in (value as Record<string, unknown>);
          })
          .map(([nodeId, value]) => ({
            nodeId,
            to: String((value as Record<string, unknown>).to ?? "unknown"),
            subject: String((value as Record<string, unknown>).subject ?? "unknown"),
          }));

        const llmEntries = Object.entries(contextRecord)
          .filter(([, value]) => {
            if (!value || typeof value !== "object") return false;
            return "copy" in (value as Record<string, unknown>);
          })
          .map(([nodeId, value]) => ({
            nodeId,
            copy: String((value as Record<string, unknown>).copy ?? ""),
          }));

        const executionLogSummary =
          executionLog.length > 0
            ? executionLog
                .map((entry, idx) => {
                  const stepType = entry.type ? ` (${entry.type})` : "";
                  return `${idx + 1}. ${entry.nodeId}${stepType} -> ${entry.status}`;
                })
                .join("\n")
            : "No execution steps returned.";

        const emailSummary =
          resendEntries.length > 0
            ? resendEntries
                .map(
                  (entry) => `- ${entry.nodeId}: emailed ${entry.to} | subject: ${entry.subject}`,
                )
                .join("\n")
            : "- No resend_email output found.";

        const copySummary =
          llmEntries.length > 0
            ? llmEntries.map((entry) => `- ${entry.nodeId}: ${entry.copy}`).join("\n")
            : "- No deepseek_llm copy output found.";

        const summaryText = [
          `Automation "${workflowName}" saved and executed successfully.`,
          "",
          "Execution log:",
          executionLogSummary,
          "",
          "Email actions:",
          emailSummary,
          "",
          "Generated copy:",
          copySummary,
        ].join("\n");

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "BUILD_AND_RUN_AUTOMATION",
          summary: {
            success: Boolean(runPayload?.success),
            nodeCount: laidOutNodes.length,
            edgeCount: edges.length,
            steps: executionLog.length,
            emailsSent: resendEntries.length,
          },
        });

        return summaryText;
      },
    }),
    execute_executive_override: tool({
      description:
        "EXECUTIVE_OVERRIDE: Halt a failing DAG sub-agent step and inject CEO-corrected payload as the ultimate source of truth. Resumes the active workspace workflow from that node through approval_gate (and resend when QA-approved). Use when sub-agents violate workspace tone/format rules or loop on bad output. Pass prior_context from the failed run's Final context JSON to skip already-completed upstream steps.",
      inputSchema: z.object({
        node_id: z
          .string()
          .describe("The DAG node id that failed (e.g. reviewer-1, writer-1)."),
        corrected_payload: z
          .string()
          .describe("The exact corrected copy or data the CEO has manually fixed."),
        reason: z
          .string()
          .describe("Why the override was necessary (rule violated, loop avoided, etc.)."),
        test_email: z
          .string()
          .optional()
          .describe("Safemode recipient email — required to resume outbound execution."),
        prior_context: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            "Optional context map from a failed automation run (Final context JSON) to skip upstream steps.",
          ),
      }),
      execute: async ({ node_id, corrected_payload, reason, test_email, prior_context }) => {
        const overrideNodeId = node_id.trim();
        const payload = corrected_payload.trim();
        const overrideReason = reason.trim();

        if (!overrideNodeId) {
          return "Executive override failed: node_id is required.";
        }
        if (!payload) {
          return "Executive override failed: corrected_payload cannot be empty.";
        }
        if (!overrideReason) {
          return "Executive override failed: reason is required.";
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "EXECUTIVE_OVERRIDE",
          node_id: overrideNodeId,
          reason: overrideReason,
          payloadLength: payload.length,
        });

        const { data: workflow, error: workflowError } = await supabase
          .from("workflows")
          .select("graph_json")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .maybeSingle();

        if (workflowError) {
          const message = `Executive override failed: could not load active workflow (${workflowError.message}).`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "EXECUTIVE_OVERRIDE",
            message,
          });
          return message;
        }

        const graph = workflow?.graph_json as
          | { nodes?: unknown[]; edges?: unknown[] }
          | null
          | undefined;
        const nodes = Array.isArray(graph?.nodes) ? graph.nodes : null;
        const edges = Array.isArray(graph?.edges) ? graph.edges : null;

        if (!nodes || !edges || nodes.length === 0) {
          const message =
            "Executive override failed: no active workflow graph. Run build_and_run_automation first.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "EXECUTIVE_OVERRIDE",
            message,
          });
          return message;
        }

        const nodeExists = nodes.some((node) => {
          if (!node || typeof node !== "object") return false;
          return (node as { id?: string }).id === overrideNodeId;
        });

        if (!nodeExists) {
          const message = `Executive override failed: node_id "${overrideNodeId}" not found in active workflow.`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "EXECUTIVE_OVERRIDE",
            message,
          });
          return message;
        }

        const safemodeEmail = test_email?.trim();
        if (!safemodeEmail) {
          return "Executive override requires test_email to safely resume the outbound pipeline.";
        }

        const runResult = await invokeRunOutbound({
          clientId,
          nodes,
          edges,
          testEmail: safemodeEmail,
          executiveOverride: {
            node_id: overrideNodeId,
            corrected_payload: payload,
            reason: overrideReason,
          },
          priorContext: prior_context,
        });

        if (!runResult.ok) {
          const message = `Executive override pipeline failed: ${runResult.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "EXECUTIVE_OVERRIDE",
            message,
          });
          return message;
        }

        const runPayload = runResult.data;
        if (runPayload?.error) {
          const message = `Executive override pipeline failed: ${runPayload.error}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "EXECUTIVE_OVERRIDE",
            message,
          });
          return message;
        }

        const executionLog = runPayload?.executionLog ?? [];
        const executionLogSummary =
          executionLog.length > 0
            ? executionLog
                .map((entry, idx) => {
                  const stepType = entry.type ? ` (${entry.type})` : "";
                  return `${idx + 1}. ${entry.nodeId}${stepType} -> ${entry.status}`;
                })
                .join("\n")
            : "No execution steps returned.";

        const summaryText = [
          `Executive override applied at node "${overrideNodeId}".`,
          `Reason: ${overrideReason}`,
          "",
          "Execution log:",
          executionLogSummary,
          "",
          "Final context:",
          JSON.stringify(runPayload?.context ?? {}, null, 2),
        ].join("\n");

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "EXECUTIVE_OVERRIDE",
          node_id: overrideNodeId,
          reason: overrideReason,
          haltedAtApprovalGate: Boolean(
            (runPayload as { haltedAtApprovalGate?: boolean } | undefined)?.haltedAtApprovalGate,
          ),
        });

        return summaryText;
      },
    }),
    hireSubAgent: tool({
      description:
        "Hires a new specialized AI sub-agent for this workspace. Provide agent_name, dynamic_system_prompt, and assigned_tools[] (min 1 from SUB-AGENT TOOL REGISTRY). Legacy role/instructions/name fields supported. DELIVERABILITY_CHIEF role keeps the fatal-constraints template wrapper.",
      inputSchema: z.object({
        agent_name: z.string().optional().describe("Display name for the new specialist."),
        dynamic_system_prompt: z
          .string()
          .optional()
          .describe("Expert-level system prompt — persona, rules, output format."),
        assigned_tools: z
          .array(z.string())
          .optional()
          .describe("Tool ids from SUB-AGENT TOOL REGISTRY (minimum 1)."),
        model: z.string().optional(),
        role: z
          .string()
          .optional()
          .describe("Legacy: UPPERCASE role slug (e.g., LINKEDIN_SPECIALIST)."),
        instructions: z.string().optional().describe("Legacy: alias for dynamic_system_prompt."),
        name: z.string().optional().describe("Legacy: alias for agent_name."),
      }),
      execute: async ({
        agent_name,
        dynamic_system_prompt,
        assigned_tools,
        model,
        role,
        instructions,
        name,
      }) => {
        const legacyMode = Boolean(role?.trim() || instructions?.trim()) && !assigned_tools?.length;

        let normalizedRole: string;
        let agentName: string;
        let resolvedSystemPrompt: string;
        let agentModel: string;
        let skills: string[];
        let tool_bindings: string[];

        if (legacyMode) {
          normalizedRole = role!.trim().toUpperCase().replace(/\s+/g, "_");
          agentName = name?.trim() || agent_name?.trim() || normalizedRole.replace(/_/g, " ");
          resolvedSystemPrompt =
            normalizedRole === DELIVERABILITY_CHIEF_ROLE
              ? buildDeliverabilityChiefSystemPrompt(instructions ?? dynamic_system_prompt ?? "")
              : (instructions ?? dynamic_system_prompt ?? "");
          agentModel = model?.trim() || "deepseek-chat";
          skills = getDefaultSkillsForRole(normalizedRole);
          tool_bindings = skills;
        } else {
          if (!agent_name?.trim() || !dynamic_system_prompt?.trim()) {
            return "hireSubAgent requires agent_name and dynamic_system_prompt (or legacy role + instructions).";
          }
          if (!assigned_tools?.length) {
            return "hireSubAgent requires assigned_tools with at least one tool from the SUB-AGENT TOOL REGISTRY.";
          }

          try {
            validateAssignedTools(assigned_tools);
          } catch (validationError) {
            return validationError instanceof Error
              ? validationError.message
              : "Invalid assigned_tools.";
          }

          const legacyRole = role?.trim().toUpperCase().replace(/\s+/g, "_");
          normalizedRole =
            legacyRole === DELIVERABILITY_CHIEF_ROLE
              ? DELIVERABILITY_CHIEF_ROLE
              : generateDynamicAgentRoleSlug();
          agentName = agent_name.trim();
          resolvedSystemPrompt =
            normalizedRole === DELIVERABILITY_CHIEF_ROLE
              ? buildDeliverabilityChiefSystemPrompt(dynamic_system_prompt)
              : dynamic_system_prompt;
          agentModel = model?.trim() || "deepseek-chat";
          const normalized = normalizeAssignedSubAgentTools(assigned_tools);
          skills = normalized.skills;
          tool_bindings = normalized.tool_bindings;
        }

        if (normalizedRole === "CEO") {
          return "BLOCKED: CEO is provisioned once per workspace and cannot be hired as a sub-agent.";
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "HIRE_SUB_AGENT",
          name: agentName,
          role: normalizedRole,
          model: agentModel,
          assigned_tools: skills,
        });

        const { error: insertError } = await supabase.from("agents").insert({
          name: agentName,
          role: normalizedRole,
          model: agentModel,
          system_prompt: resolvedSystemPrompt,
          client_id: clientId,
          reports_to_agent_id: ceoAgent.id,
          skills,
          tool_bindings,
          is_active: true,
        });

        if (insertError) {
          const message = `Failed to hire sub-agent: ${insertError.message}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "HIRE_SUB_AGENT",
            message,
          });
          return message;
        }

        const message = `Successfully hired ${agentName} (${normalizedRole}) with tools: ${skills.join(", ")}. They are now available for delegation via spawn_sub_agent using their roster id.`;
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "HIRE_SUB_AGENT",
          name: agentName,
          role: normalizedRole,
          assigned_tools: skills,
        });

        return message;
      },
    }),
    configureAutomatedSequence: tool({
      description:
        "Saves finalized email sequence steps to the workspace campaign_sequences table for the active client. REQUIRED: every step MUST use standard merge variables {{first_name}} and {{company_name}} in the subject or body ({{prospect_name}} and {{company}} are also supported). Only call after sub-agents have drafted and approved the sequence.",
      inputSchema: z.object({
        steps: z
          .array(
            z.object({
              step_number: z
                .number()
                .int()
                .min(1)
                .max(3)
                .describe("Sequence step index (1 = cold open, 2 = follow-up, 3 = breakup)."),
              subject: z.string().describe("Email subject line with merge variables."),
              body: z.string().describe("Email body with merge variables."),
              delay_days: z
                .number()
                .int()
                .min(0)
                .describe("Days to wait after the previous step before sending."),
            }),
          )
          .min(1)
          .max(3),
      }),
      execute: async ({ steps }) => {
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "CONFIGURE_AUTOMATED_SEQUENCE",
          clientId,
          stepCount: steps.length,
        });

        const result = await upsertCampaignSequencesServer(clientId, steps);

        if ("error" in result) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "CONFIGURE_AUTOMATED_SEQUENCE",
            message: result.error,
          });
          return result.error;
        }

        const summary = result.steps
          .map(
            (step) =>
              `Step ${step.step_number}: "${step.subject}" (delay ${step.delay_days}d)`,
          )
          .join("\n");

        const message = `Saved ${result.steps.length} sequence step(s) for this workspace.\n${summary}`;
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "CONFIGURE_AUTOMATED_SEQUENCE",
          stepCount: result.steps.length,
        });

        return message;
      },
    }),
    logOperationalObservation: tool({
      description:
        "Saves a learned operational lesson to agent memory after mission success or failure. Use to self-evolve: record what worked, what failed, and the actionable strategy to apply next time.",
      inputSchema: z.object({
        summary: z.string().describe("Brief description of the task or mission observed."),
        outcome: z
          .enum(["SUCCESS", "FAILURE"])
          .describe("Whether the observed mission succeeded or failed."),
        strategy: z
          .string()
          .describe("Actionable lesson to apply on future similar missions."),
        scope: z
          .enum(["LOCAL", "GLOBAL"])
          .optional()
          .describe(
            "LOCAL (default) saves to this workspace; GLOBAL shares the lesson agency-wide.",
          ),
      }),
      execute: async ({ summary, outcome, strategy, scope }) => {
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "LOG_OPERATIONAL_OBSERVATION",
          summary,
          outcome,
          scope: scope ?? "LOCAL",
        });

        const result = await persistOperationalObservation(clientId, {
          summary,
          outcome,
          strategy,
          scope: scope === "GLOBAL" ? "GLOBAL" : "LOCAL",
        });

        if (!result.ok) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "LOG_OPERATIONAL_OBSERVATION",
            message: result.error,
          });
          return result.error;
        }

        const message = `Operational lesson saved (${scope ?? "LOCAL"}, ${outcome}).`;
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "LOG_OPERATIONAL_OBSERVATION",
          memoryId: result.id,
        });

        return message;
      },
    }),
    alertHumanOperator: tool({
      description:
        "Sends a Slack alert to the human operator. Use channel 'ops' for technical failures, infrastructure errors, or system status. Use channel 'leads' for positive prospect engagement, meeting bookings, or conversions. Never send technical logs to the leads channel.",
      inputSchema: z.object({
        channel: z
          .enum(["ops", "leads"])
          .describe("ops = infrastructure/system alerts; leads = revenue-positive engagement."),
        level: z
          .enum(["warning", "critical"])
          .describe("warning for non-blocking issues; critical for urgent failures."),
        message: z.string().describe("Clear, actionable alert body for the operator."),
      }),
      execute: async ({ channel, level, message }) => {
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "ALERT_HUMAN_OPERATOR",
          channel,
          level,
        });

        const result = await alertHumanOperator(channel, level, message);

        if (!result.ok) {
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "ALERT_HUMAN_OPERATOR",
            channel,
            message: result.error,
          });
          return result.error;
        }

        const confirmation = `Slack alert sent to ${channel} channel (${level}).`;
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "ALERT_HUMAN_OPERATOR",
          channel,
          level,
        });

        return confirmation;
      },
    }),
    triggerOutboundCampaign: tool({
      description:
        "Launches the automated outbound sequence for this workspace by triggering the outbound processing cron. Use once the team is hired and the human operator has configured the pipeline.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!getCronSecret()) {
          const message = "CRON_SECRET is not configured; cannot trigger outbound campaign.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_OUTBOUND_CAMPAIGN",
            message,
          });
          return message;
        }

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "TRIGGER_OUTBOUND_CAMPAIGN",
          clientId,
        });

        const cronAuthHeaders = buildCronAuthHeaders();
        if (!cronAuthHeaders) {
          const message = "CRON_SECRET is not configured; cannot trigger outbound campaign.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_OUTBOUND_CAMPAIGN",
            message,
          });
          return message;
        }

        const baseUrl = resolveCronBaseUrl();
        const cronUrl = new URL(`${baseUrl}/api/cron/process-outbound`);
        cronUrl.searchParams.set("clientId", clientId);

        let body: Record<string, unknown> | null = null;

        try {
          const response = await fetch(cronUrl.toString(), {
            method: "GET",
            headers: cronAuthHeaders,
          });

          body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

          if (response.ok) {
            const result = { success: true, ...body };
            await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
              status: "SUCCESS",
              action: "TRIGGER_OUTBOUND_CAMPAIGN",
              result,
            });
            return result;
          }

          if (response.status !== 401) {
            const message =
              typeof body?.error === "string"
                ? body.error
                : `Outbound cron failed (${response.status}).`;
            await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
              status: "ERROR",
              action: "TRIGGER_OUTBOUND_CAMPAIGN",
              message,
            });
            return message;
          }
        } catch (fetchError) {
          console.error("[triggerOutboundCampaign] Cron fetch failed:", fetchError);
        }

        // Self-fetch can 401 behind deployment protection; invoke the handler directly.
        try {
          const directResult = await processOutboundQueue({ clientId });
          const result = { success: true, ...directResult };
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "SUCCESS",
            action: "TRIGGER_OUTBOUND_CAMPAIGN",
            result,
            via: "direct",
          });
          return result;
        } catch (directError) {
          const message =
            directError instanceof Error
              ? directError.message
              : "Outbound cron failed after auth retry.";
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_OUTBOUND_CAMPAIGN",
            message,
          });
          return message;
        }
      },
    }),
  };

  const ceoSkills = getEffectiveToolBindings(ceoAgent);
  const enabledCeoTools = filterCeoTools(tools, ceoSkills);
  const canDelegate = ceoSkills.includes("delegate_sub_agent");
  const ceoTools = {
    ...enabledCeoTools,
    ...(canDelegate ? { spawn_ephemeral_agent: tools.spawn_ephemeral_agent } : {}),
    fetch_crm_lead: tools.fetch_crm_lead,
    execute_executive_override: tools.execute_executive_override,
    hireSubAgent: tools.hireSubAgent,
    configureAutomatedSequence: tools.configureAutomatedSequence,
    logOperationalObservation: tools.logOperationalObservation,
    alertHumanOperator: tools.alertHumanOperator,
    triggerOutboundCampaign: tools.triggerOutboundCampaign,
  };

  const { systemPrompt: ceoSystemPrompt } = await fetchWorkspaceCeoSystemPrompt(clientId);
  const memoryResult = await fetchOperationalMemory(clientId);
  const operationalMemorySection = formatOperationalMemorySection(memoryResult.rows);

  const response = await generateText({
    model: deepseek("deepseek-chat"),
    system: buildCeoLlmSystemMessage(ceoSystemPrompt, {
      operationalMemorySection,
      rosterText,
      coreToolRegistrySection,
      clientContext,
      knowledgeVaultDirective,
      emailDagDirective,
      executiveOverrideDirective,
      autonomyDirective,
    }),
    prompt,
    tools: ceoTools,
    stopWhen: stepCountIs(10),
  });

  await logInsert(executionId, clientId, ceoAgent.id, "THOUGHT", {
    thought: response.text,
  });

  return {
    executionId,
    text: response.text,
  };
}
