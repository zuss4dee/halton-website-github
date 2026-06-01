import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

import type { ClientRow } from "@/lib/admin/clientsRepository";

import { deepseek } from "./providers";
import { executeSubAgent } from "./sub-agent-router";

type CEOAgent = {
  id: string;
  role: string;
  system_prompt: string;
};

export type CEOCommandResult = {
  executionId: string;
  text: string;
};

function logInsert(
  executionId: string,
  clientId: string,
  agentId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return supabase.from("agent_logs").insert({
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
): Promise<CEOCommandResult> {
  const trimmed = userCommand.trim();
  if (!trimmed) {
    throw new Error("Command cannot be empty.");
  }

  if (!clientId.trim()) {
    throw new Error("clientId is required.");
  }

  const executionId = crypto.randomUUID();

  const { data: ceo, error } = await supabase
    .from("agents")
    .select("*")
    .eq("role", "CEO")
    .single();

  if (error || !ceo) {
    throw new Error("CRITICAL: CEO Agent offline.");
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

  await logInsert(executionId, clientId, ceoAgent.id, "SPAWN", {
    action: "INITIALIZING_ROUTER",
    command: trimmed,
    clientId,
  });

  if (onBooted) {
    await onBooted(executionId);
  }

  const tools = {
    spawn_sub_agent: tool({
      description:
        "Delegate a focused task to a specialist sub-agent. Use RESEARCHER for data gathering and COPYWRITER for outbound messaging.",
      inputSchema: z.object({
        targetAgentRole: z.enum(["RESEARCHER", "COPYWRITER"]),
        specificTask: z
          .string()
          .describe("The exact instruction for the sub-agent."),
      }),
      execute: async ({ targetAgentRole, specificTask }) => {
        await logInsert(executionId, clientId, ceoAgent.id, "TOOL_CALL", {
          action: "SPAWNING_AGENT",
          target: targetAgentRole,
          task: specificTask,
        });

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
  };

  const response = await generateText({
    model: deepseek("deepseek-chat"),
    system: `${ceoAgent.system_prompt}\n\n${clientContext}`,
    prompt: trimmed,
    tools,
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
