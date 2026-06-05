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
  resolveClientId,
  saveToKnowledgeVault,
  searchClientKnowledge,
  VAULT_SAVE_CATEGORIES,
  type KnowledgeCategory,
  type VaultSaveCategory,
} from "@/lib/admin/clientKnowledge";
import { filterCeoTools, getDefaultSkillsForRole } from "@/lib/admin/agentConfig";
import { resolveAgentForWorkspaceServer } from "@/lib/admin/provisionWorkspaceCeo";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getEffectiveToolBindings } from "@/lib/admin/agentStudio";
import { formatReplyContextForCeo, type TerminalReplyContext } from "@/lib/admin/terminalReply";

import { deepseek } from "./providers";
import { executeSubAgent } from "./sub-agent-router";

type CEOAgent = {
  id: string;
  role: string;
  system_prompt: string;
  skills?: unknown;
  tool_bindings?: unknown;
};

type AgentRosterRow = {
  role: string;
  system_prompt: string;
};

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

  const ceoResolved = await resolveAgentForWorkspaceServer("CEO", clientId);
  if (!ceoResolved.agent) {
    throw new Error(ceoResolved.error ?? "CRITICAL: CEO Agent offline.");
  }

  const ceo = ceoResolved.agent;

  const { data: rosterData, error: rosterError } = await supabase
    .from("agents")
    .select("role, system_prompt")
    .or(`client_id.eq.${clientId},client_id.is.null`);

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
      ? roster.map((agent) => `- ${agent.role}: ${summarizePrompt(agent.system_prompt)}`).join("\n")
      : "- No specialized sub-agents currently registered.";
  const rosterRoles = roster.map((agent) => agent.role).filter(Boolean);

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
Required pipeline: deepseek_llm (label "DeepSeek Writer") -> copy_reviewer (type copy_reviewer, label "Deliverability Chief") -> approval_gate (queues sanitized body) -> resend_email (optional test send).
The 4th node in a 5-step Apollo campaign MUST be type copy_reviewer with data.label exactly "Deliverability Chief" — never "AI Writer".
approval_gate and resend_email MUST use data.body = {{steps.<reviewer_node_id>.copy}} only.
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
      description: `Delegate a focused task to a specialist sub-agent. When delegating, use the exact Role name from the live roster: ${rosterRoles.length > 0 ? rosterRoles.join(", ") : "No roles available yet"}.`,
      inputSchema: z.object({
        targetAgentRole: z
          .string()
          .describe("Exact role name from the live roster (e.g., RESEARCHER)."),
        specificTask: z.string().describe("The exact instruction for the sub-agent."),
      }),
      execute: async ({ targetAgentRole, specificTask }) => {
        const normalizedTarget = targetAgentRole.trim().toUpperCase();
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
          target: targetAgentRole,
          task: specificTask,
        });

        const targetResolved = await resolveAgentForWorkspaceServer(targetAgentRole, clientId);
        if (!targetResolved.agent) {
          return targetResolved.error ?? `CRITICAL: ${targetAgentRole} Agent offline.`;
        }

        const subAgentResult = await executeSubAgent(
          targetAgentRole,
          specificTask,
          clientId,
          executionId,
        );

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
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

        const { data: runData, error: runError } = await supabase.functions.invoke("run-outbound", {
          body: {
            clientId: targetClientId,
            nodes,
            edges,
            ...(testEmail ? { testEmail } : {}),
          },
        });

        if (runError) {
          const message = `Workflow execution failed: ${runError.message}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "TRIGGER_AUTOMATION_SOP",
            message,
          });
          return message;
        }

        const runPayload = runData as {
          success?: boolean;
          executionLog?: Array<{ nodeId: string; type?: string; status: string }>;
          context?: Record<string, unknown>;
          error?: string;
        } | null;
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
        'ONLY approved path for outbound email generation. Builds a workflow graph, saves the active SOP, and runs run-outbound. REQUIRED FIRST: search_client_knowledge. NEVER use spawn_sub_agent/COPYWRITER to queue emails. STRICT LABELS: every node needs data.label. deepseek_llm -> label exactly "DeepSeek Writer". copy_reviewer -> type MUST be copy_reviewer (NOT deepseek_llm) and label exactly "Deliverability Chief" (never "AI Writer"). 5-step Apollo campaign (node order): (1) trigger, (2) apollo_search, (3) deepseek_llm, (4) copy_reviewer, (5) approval_gate, (6) resend_email optional. 4-step without Apollo: trigger -> deepseek_llm -> copy_reviewer -> approval_gate -> resend_email. STRICT WIRING: copy_reviewer data.draft = {{steps.<writer_id>.copy}}. approval_gate data.body AND resend_email data.body MUST be {{steps.<reviewer_id>.copy}} only — approval_gate writes sanitized copy to the Human Review Queue. Unique ids (writer-1, reviewer-1, gate-1); linear edges.',
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

        const { data: runData, error: runError } = await supabase.functions.invoke("run-outbound", {
          body: {
            clientId: targetClientId,
            nodes: laidOutNodes,
            edges,
            testEmail: testEmail.trim(),
          },
        });

        if (runError) {
          const message = `Workflow execution failed: ${runError.message}`;
          await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
            status: "ERROR",
            action: "BUILD_AND_RUN_AUTOMATION",
            message,
          });
          return message;
        }

        const runPayload = runData as {
          success?: boolean;
          executionLog?: Array<{ nodeId: string; type?: string; status: string }>;
          context?: Record<string, unknown>;
          error?: string;
        } | null;

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
    hireSubAgent: tool({
      description:
        "Hires a new specialized AI sub-agent for this workspace. Use after reviewing client data to dynamically build a tailored team. Provide detailed instructions that become the agent's system prompt. If role is DELIVERABILITY_CHIEF, the saved prompt is automatically merged with draconian fatal constraints (body-only output, max 3 sentences, sign as Damilare, no name hallucination).",
      inputSchema: z.object({
        role: z
          .string()
          .describe("UPPERCASE role slug with no spaces (e.g., LINKEDIN_SPECIALIST)."),
        instructions: z
          .string()
          .describe(
            "Expert-level system prompt defining the agent's persona, rules of operation, and output format.",
          ),
        name: z.string().optional(),
        model: z.string().optional(),
      }),
      execute: async ({ role, instructions, name, model }) => {
        const normalizedRole = role.trim().toUpperCase().replace(/\s+/g, "_");
        const agentName = name?.trim() || normalizedRole.replace(/_/g, " ");
        const agentModel = model?.trim() || "deepseek-chat";

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "HIRE_SUB_AGENT",
          name: agentName,
          role: normalizedRole,
          model: agentModel,
        });

        const resolvedSystemPrompt =
          normalizedRole === DELIVERABILITY_CHIEF_ROLE
            ? buildDeliverabilityChiefSystemPrompt(instructions)
            : instructions;

        const { error: insertError } = await supabase.from("agents").insert({
          name: agentName,
          role: normalizedRole,
          model: agentModel,
          system_prompt: resolvedSystemPrompt,
          client_id: clientId,
          skills: getDefaultSkillsForRole(normalizedRole),
          tool_bindings: getDefaultSkillsForRole(normalizedRole),
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

        const message = `Successfully hired ${agentName} (${normalizedRole}). They are now available for delegation.`;
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "HIRE_SUB_AGENT",
          name: agentName,
          role: normalizedRole,
        });

        return message;
      },
    }),
    triggerOutboundCampaign: tool({
      description:
        "Launches the automated outbound sequence for this workspace by triggering the outbound processing cron. Use once the team is hired and the human operator has configured the pipeline.",
      inputSchema: z.object({}),
      execute: async () => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
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

        const baseUrl = resolveCronBaseUrl();
        const response = await fetch(`${baseUrl}/api/cron/process-outbound`, {
          method: "GET",
          headers: {
            "x-cron-secret": cronSecret,
            Authorization: `Bearer ${cronSecret}`,
          },
        });

        const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

        if (!response.ok) {
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

        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_RESULT", {
          status: "SUCCESS",
          action: "TRIGGER_OUTBOUND_CAMPAIGN",
          result: body,
        });

        return body ?? { success: true };
      },
    }),
  };

  const ceoSkills = getEffectiveToolBindings(ceoAgent);
  const enabledCeoTools = filterCeoTools(tools, ceoSkills);
  const ceoTools = {
    ...enabledCeoTools,
    hireSubAgent: tools.hireSubAgent,
    triggerOutboundCampaign: tools.triggerOutboundCampaign,
  };

  const response = await generateText({
    model: deepseek("deepseek-chat"),
    system: `${ceoAgent.system_prompt}

Here is your current roster of specialized sub-agents you can delegate to:
${rosterText}

When delegating, use the exact Role name.

${knowledgeVaultDirective}

${emailDagDirective}

${clientContext}`,
    prompt,
    tools: ceoTools,
    stopWhen: stepCountIs(5),
  });

  await logInsert(executionId, clientId, ceoAgent.id, "THOUGHT", {
    thought: response.text,
  });

  return {
    executionId,
    text: response.text,
  };
}
