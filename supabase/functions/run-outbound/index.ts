import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VaultKeys = {
  apollo_api_key: string | null;
  deepseek_api_key: string;
  resend_api_key: string;
};

type FlowNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

type FlowEdge = {
  id?: string;
  source: string;
  target: string;
};

type EnrichedTarget = {
  email: string | null;
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  apollo_person_id: string;
};

type ExecutionContext = Record<string, unknown>;

const DEFAULT_DEEPSEEK_PROMPT =
  "Write a casual, 2-sentence cold email opening line to {{steps.APOLLO_NODE.first_name}}, the {{steps.APOLLO_NODE.title}} at {{steps.APOLLO_NODE.company}}. Acknowledge their role and ask if they are currently taking on new clients. Do not include placeholders or signature blocks.";

const DEFAULT_RESEND_SUBJECT = "Quick question for {{steps.APOLLO_NODE.company}}";
const DEFAULT_RESEND_BODY = "{{steps.REVIEWER_NODE.copy}}\n\nLet's chat.\n- Damilare";

const DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS = `STRICT NEGATIVE CONSTRAINTS (violating any rule = failed output):
1. FATAL ERROR IF: You include the word "Subject:" or the actual subject line in your output. Output ONLY the body copy.
2. FATAL ERROR IF: The text is longer than 3 sentences. You MUST use heavy line breaks between sentences.
3. FATAL ERROR IF: You use placeholders like [Your Name]. Always sign off as "Damilare".
4. FATAL ERROR IF: You invent or swap prospect names. Check the prospect's actual name in the user message (draft). Do not hallucinate names like "Mark" if the draft uses a different name.`;

const DELIVERABILITY_CHIEF_FALLBACK_PROMPT = `You are the DELIVERABILITY_CHIEF — a draconian cold-email deliverability critic.

Your job is to rewrite the draft email BODY so it passes spam filters and lands in the primary inbox.

Operational rules:
- Remove spam trigger words (free, guarantee, act now, limited time, etc.)
- No ALL CAPS, excessive punctuation, or misleading hooks
- Preserve the core intent and CTA from the draft
- Do not add links unless the draft already had them
- Maximum 3 sentences total, each on its own line with heavy line breaks
- Sign off exactly as Damilare (never placeholders)
- Return ONLY the sanitized email body — no preamble, quotes, labels, markdown fences, or subject line

${DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS}`;

const DELIVERABILITY_CHIEF_ROLE = "DELIVERABILITY_CHIEF";

function applyDeliverabilityChiefConstraints(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return DELIVERABILITY_CHIEF_FALLBACK_PROMPT;
  if (trimmed.includes("FATAL ERROR IF:")) return trimmed;
  return `${trimmed}\n\n${DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS}`;
}

/** Replace `{{steps.<nodeId>.<field>}}` with values from execution context. */
function interpolate(text: string, context: ExecutionContext): string {
  return text.replace(/\{\{steps\.([^.}]+)\.([^}]+)\}\}/g, (_match, nodeId: string, field: string) => {
    const nodeOutput = context[nodeId];
    if (nodeOutput === null || nodeOutput === undefined) return "";

    if (typeof nodeOutput === "object" && !Array.isArray(nodeOutput)) {
      const value = (nodeOutput as Record<string, unknown>)[field];
      if (value === null || value === undefined) return "";
      return String(value);
    }

    if (field === "value" || field === "copy") {
      return String(nodeOutput);
    }

    return "";
  });
}

function getNodeDataString(node: FlowNode, key: string, fallback = ""): string {
  const value = node.data?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function findCopyReviewerNodeId(sortedNodes: FlowNode[]): string | null {
  const reviewer = sortedNodes.find((node) => node.type === "copy_reviewer");
  return reviewer?.id ?? null;
}

function stripSubjectLineFromBody(text: string): string {
  return text.replace(/^Subject:\s*.*(?:\r?\n){1,2}/i, "").trim();
}

function resolveSanitizedEmailBody(
  node: FlowNode,
  sortedNodes: FlowNode[],
  context: ExecutionContext,
): string {
  const reviewerId = findCopyReviewerNodeId(sortedNodes);
  if (!reviewerId) {
    throw new Error(
      "Missing copy_reviewer node. Human Review Queue requires sanitized {{steps.<reviewer_id>.copy}}.",
    );
  }

  const configured =
    getNodeDataString(node, "body") || getNodeDataString(node, "copy") || "";
  const usesReviewer =
    configured.includes(`steps.${reviewerId}.copy`) ||
    configured.includes(`steps.${reviewerId}`);

  const template = usesReviewer && configured.trim()
    ? configured
    : `{{steps.${reviewerId}.copy}}`;

  const body = stripSubjectLineFromBody(interpolate(template, context));
  if (!body) {
    throw new Error(
      `Empty sanitized copy from copy_reviewer (${reviewerId}). Run the Deliverability Chief before approval_gate/resend_email.`,
    );
  }

  return body;
}

function findApolloLead(
  context: ExecutionContext,
  sortedNodes: FlowNode[],
): EnrichedTarget | null {
  for (const node of sortedNodes) {
    if (node.type !== "apollo_search") continue;
    const lead = context[node.id];
    if (lead && typeof lead === "object" && !Array.isArray(lead)) {
      return lead as EnrichedTarget;
    }
  }
  return null;
}

function sortNodesByEdges(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: FlowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const targetId of adjacency.get(id) ?? []) {
      const nextDegree = (inDegree.get(targetId) ?? 1) - 1;
      inDegree.set(targetId, nextDegree);
      if (nextDegree === 0) queue.push(targetId);
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) sorted.push(node);
  }

  return sorted;
}

function buildDefaultWorkflow(testEmail: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: [
      { id: "trigger-1", type: "trigger", data: { testEmail } },
      { id: "apollo-1", type: "apollo_search" },
      {
        id: "llm-1",
        type: "deepseek_llm",
        data: {
          prompt: DEFAULT_DEEPSEEK_PROMPT.replace(/APOLLO_NODE/g, "apollo-1").replace(
            /LLM_NODE/g,
            "llm-1",
          ),
        },
      },
      {
        id: "reviewer-1",
        type: "copy_reviewer",
        data: {
          label: "Deliverability Chief",
          draft: "{{steps.llm-1.copy}}",
        },
      },
      {
        id: "gate-1",
        type: "approval_gate",
        data: {
          label: "Human Review Queue",
          subject: DEFAULT_RESEND_SUBJECT.replace(/APOLLO_NODE/g, "apollo-1"),
          body: "{{steps.reviewer-1.copy}}",
        },
      },
      {
        id: "email-1",
        type: "resend_email",
        data: {
          to: "{{steps.trigger-1.email}}",
          subject: DEFAULT_RESEND_SUBJECT.replace(/APOLLO_NODE/g, "apollo-1"),
          body: DEFAULT_RESEND_BODY.replace(/REVIEWER_NODE/g, "reviewer-1").replace(
            /APOLLO_NODE/g,
            "apollo-1",
          ),
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "apollo-1" },
      { id: "e2", source: "apollo-1", target: "llm-1" },
      { id: "e3", source: "llm-1", target: "reviewer-1" },
      { id: "e4", source: "reviewer-1", target: "gate-1" },
      { id: "e5", source: "gate-1", target: "email-1" },
    ],
  };
}

async function parseJsonResponse(response: Response, step: string): Promise<unknown> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error(`[${step}] Invalid JSON:`, text.slice(0, 500));
    throw new Error(`${step}: Invalid JSON response`);
  }
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : `${step}: HTTP ${response.status}`;
    console.error(`[${step}]`, response.status, data);
    throw new Error(message);
  }
  return data;
}

function apolloFallbackMockLead(): EnrichedTarget {
  return {
    apollo_person_id: "mock-tier-limit-fallback",
    first_name: "James",
    last_name: "Holden",
    title: "VP of Operations",
    company: "FastFreight UK",
    email: "james.mock@example.com",
  };
}

function logApolloFallback(response: Response | null, reason?: string) {
  if (response?.status === 403) {
    console.warn("[apollo_search] 403 encountered, falling back to mock lead data.");
    return;
  }

  const status = response ? `HTTP ${response.status}` : reason ?? "request failed";
  console.warn(`[apollo_search] ${status}, falling back to mock lead data.`);
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response");
  }
}

async function runApolloSearch(
  keys: VaultKeys,
  testEmail: string,
  useLiveApollo: boolean,
): Promise<EnrichedTarget> {
  if (!useLiveApollo) {
    const mock: EnrichedTarget = {
      apollo_person_id: "mock-person-id",
      email: testEmail,
      first_name: "James",
      last_name: "Bond",
      title: "Agency Director",
      company: "MI6 Marketing",
    };
    console.info("[apollo_search] MOCK lead:", mock);
    return mock;
  }

  try {
    const searchResponse = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": keys.apollo_api_key!,
      },
      body: JSON.stringify({
        person_titles: ["Agency Director", "Founder"],
        person_locations: ["United Kingdom"],
        per_page: 1,
      }),
    });

    if (!searchResponse.ok) {
      logApolloFallback(searchResponse);
      return apolloFallbackMockLead();
    }

    const searchData = (await parseJsonBody(searchResponse)) as {
      people?: Array<{ id?: string }>;
    };

    const firstPerson = searchData.people?.[0];
    if (!firstPerson?.id) {
      console.warn("[apollo_search] No person id in search results, falling back to mock lead data.");
      return apolloFallbackMockLead();
    }

    const enrichResponse = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": keys.apollo_api_key!,
      },
      body: JSON.stringify({ id: firstPerson.id }),
    });

    if (!enrichResponse.ok) {
      logApolloFallback(enrichResponse);
      return apolloFallbackMockLead();
    }

    const enrichData = (await parseJsonBody(enrichResponse)) as {
      person?: Record<string, unknown>;
    };

    const person = enrichData.person ?? (enrichData as Record<string, unknown>);
    const org = person.organization as { name?: string } | undefined;

    return {
      apollo_person_id: firstPerson.id,
      email: typeof person.email === "string" ? person.email : null,
      first_name: typeof person.first_name === "string" ? person.first_name : "there",
      last_name: typeof person.last_name === "string" ? person.last_name : "",
      title: typeof person.title === "string" ? person.title : "Leader",
      company:
        typeof org?.name === "string"
          ? org.name
          : typeof person.organization_name === "string"
            ? person.organization_name
            : "their company",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logApolloFallback(null, message);
    return apolloFallbackMockLead();
  }
}

async function runDeepseekCompletion(
  keys: VaultKeys,
  systemPrompt: string,
  userContent: string,
  stepLabel: string,
): Promise<string> {
  const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.deepseek_api_key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  const deepseekData = (await parseJsonResponse(deepseekResponse, stepLabel)) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const copy = deepseekData.choices?.[0]?.message?.content?.trim() ?? "";
  if (!copy) throw new Error(`${stepLabel}: Empty completion content`);

  return copy;
}

async function runDeepseek(
  keys: VaultKeys,
  prompt: string,
): Promise<{ copy: string; prompt: string }> {
  const copy = await runDeepseekCompletion(
    keys,
    "You are an elite B2B copywriter.",
    prompt,
    "deepseek_llm",
  );
  return { copy, prompt };
}

async function fetchDeliverabilityChiefPrompt(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("system_prompt")
      .eq("role", DELIVERABILITY_CHIEF_ROLE)
      .maybeSingle();

    const prompt = typeof data?.system_prompt === "string" ? data.system_prompt.trim() : "";
    if (!error && prompt.length > 0) {
      return applyDeliverabilityChiefConstraints(prompt);
    }
  } catch (fetchError) {
    console.warn("[copy_reviewer] Failed to load DELIVERABILITY_CHIEF prompt:", fetchError);
  }

  return DELIVERABILITY_CHIEF_FALLBACK_PROMPT;
}

async function runResend(
  keys: VaultKeys,
  to: string,
  subject: string,
  textBody: string,
): Promise<{ messageId: string; to: string; subject: string; format: "text" }> {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.resend_api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Damilare Adeosun <damilare@haltonworks.com>",
      to,
      subject,
      text: textBody,
      tags: [{ name: "category", value: "cold_outreach" }],
      // Resend open/click tracking is domain-scoped; plain-text + these headers avoid promotional HTML signals.
      headers: {
        "X-Resend-Open-Tracking": "false",
        "X-Resend-Click-Tracking": "false",
      },
    }),
  });

  const resendData = (await parseJsonResponse(resendResponse, "resend_email")) as {
    id?: string;
  };

  if (!resendData.id) throw new Error("resend_email: Missing message id in response");

  return { messageId: resendData.id, to, subject, format: "text" };
}

async function insertStepLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    executionId: string;
    clientId: string;
    eventType: "STEP_START" | "STEP_COMPLETE";
    nodeId: string;
    nodeType: string;
    result?: unknown;
  },
) {
  try {
    const payload: Record<string, unknown> = {
      nodeId: input.nodeId,
      nodeType: input.nodeType,
    };

    if (input.result !== undefined) {
      payload.result = input.result;
    }

    await supabaseAdmin.from("agent_logs").insert({
      execution_id: input.executionId,
      client_id: input.clientId,
      event_type: input.eventType,
      payload,
    });
  } catch (error) {
    console.warn("[run-outbound] failed to insert step log:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const clientId = body.clientId as string | undefined;
    const testEmail = (body.testEmail ?? body.email) as string | undefined;
    let nodes = body.nodes as FlowNode[] | undefined;
    let edges = body.edges as FlowEdge[] | undefined;

    if (!clientId) throw new Error("Missing clientId in request body");
    if (!testEmail) {
      throw new Error("Missing testEmail or email in request body (safemode destination)");
    }

    if (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length === 0) {
      const fallback = buildDefaultWorkflow(testEmail);
      nodes = fallback.nodes;
      edges = fallback.edges;
      console.info("[run-outbound] Using default DAG workflow (no nodes/edges in payload)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge runtime");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    console.log("Incoming clientId received by function:", clientId);
    console.log("DAG nodes:", nodes.length, "edges:", edges.length);

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("apollo_api_key, deepseek_api_key, resend_api_key")
      .eq("id", clientId)
      .single();

    if (clientError) {
      console.error("Supabase DB Query Error Details:", JSON.stringify(clientError, null, 2));
      return new Response(
        JSON.stringify({
          error: "Failed to load client vault keys",
          details: clientError.message,
          code: clientError.code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    console.log("Successfully retrieved keys for client:", clientId);

    if (!clientData?.deepseek_api_key || !clientData?.resend_api_key) {
      throw new Error("Missing required vault keys (deepseek_api_key, resend_api_key)");
    }

    const keys = clientData as VaultKeys;
    const useLiveApollo = Boolean(keys.apollo_api_key?.trim());

    const executionId = crypto.randomUUID();
    const context: ExecutionContext = {};
    const sortedNodes = sortNodesByEdges(nodes, edges);
    const executionLog: Array<{ nodeId: string; type: string; status: string }> = [];
    let deliverabilityChiefPrompt: string | null = null;

    console.info(
      "[run-outbound] Execution order:",
      sortedNodes.map((n) => `${n.id}:${n.type}`).join(" -> "),
    );

    for (const node of sortedNodes) {
      const nodeType = node.type === "tool" ? getNodeDataString(node, "executor", node.type) : node.type;

      await insertStepLog(supabaseAdmin, {
        executionId,
        clientId,
        eventType: "STEP_START",
        nodeId: node.id,
        nodeType,
      });

      try {
        let stepResult: unknown = null;

        switch (nodeType) {
          case "trigger": {
            const payload = {
              testEmail,
              email: testEmail,
              triggeredAt: new Date().toISOString(),
            };
            context[node.id] = payload;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] trigger`, payload);
            stepResult = payload;
            break;
          }

          case "apollo_search": {
            const lead = await runApolloSearch(keys, testEmail, useLiveApollo);
            const safemodeLead = { ...lead, email: testEmail };
            context[node.id] = safemodeLead;
            const usedFallback = lead.apollo_person_id === "mock-tier-limit-fallback";
            executionLog.push({
              nodeId: node.id,
              type: nodeType,
              status: usedFallback ? "fallback" : "ok",
            });
            console.info(`[${node.id}] apollo_search`, safemodeLead);
            stepResult = safemodeLead;
            break;
          }

          case "deepseek_llm": {
            const rawPrompt =
              getNodeDataString(node, "prompt") ||
              DEFAULT_DEEPSEEK_PROMPT.replace(/APOLLO_NODE/g, sortedNodes.find((n) =>
                n.type === "apollo_search"
              )?.id ?? "apollo-1");

            const prompt = interpolate(rawPrompt, context);
            const { copy, prompt: resolvedPrompt } = await runDeepseek(keys, prompt);
            context[node.id] = { copy, prompt: resolvedPrompt };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] deepseek_llm copy length:`, copy.length);
            stepResult = { copy, prompt: resolvedPrompt };
            break;
          }

          case "copy_reviewer": {
            const rawDraft = getNodeDataString(node, "draft");
            const draft = interpolate(rawDraft, context);
            if (!draft.trim()) {
              throw new Error(
                "copy_reviewer: Empty draft after interpolation. Set data.draft to {{steps.<writer_node_id>.copy}}.",
              );
            }

            if (!deliverabilityChiefPrompt) {
              deliverabilityChiefPrompt = await fetchDeliverabilityChiefPrompt(supabaseAdmin);
            }

            const sanitizedText = await runDeepseekCompletion(
              keys,
              deliverabilityChiefPrompt,
              draft,
              "copy_reviewer",
            );

            context[node.id] = { copy: sanitizedText };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] copy_reviewer sanitized length:`, sanitizedText.length);
            stepResult = { copy: sanitizedText };
            break;
          }

          case "approval_gate": {
            const bodyText = resolveSanitizedEmailBody(node, sortedNodes, context);
            const rawSubject = getNodeDataString(node, "subject", DEFAULT_RESEND_SUBJECT);
            const subject = interpolate(rawSubject, context);
            const lead = findApolloLead(context, sortedNodes);
            const leadEmail = lead?.email?.trim() || testEmail;
            const prospectName = lead
              ? `${lead.first_name} ${lead.last_name}`.trim() || lead.first_name
              : "Prospect";

            const { error: queueError } = await supabaseAdmin.from("leads").upsert(
              {
                client_id: clientId,
                email: leadEmail,
                prospect_name: prospectName,
                target_company: lead?.company ?? "Unknown Company",
                target_role: lead?.title ?? null,
                generated_copy: bodyText,
                campaign_status: "PENDING_REVIEW",
                queue_status: "pending",
              },
              { onConflict: "email,client_id" },
            );

            if (queueError) {
              throw new Error(`approval_gate: Human Review Queue insert failed: ${queueError.message}`);
            }

            const queuePayload = {
              queued: true,
              email: leadEmail,
              subject,
              body: bodyText,
              source: "copy_reviewer",
            };
            context[node.id] = queuePayload;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] approval_gate queued for review`, queuePayload);
            stepResult = queuePayload;
            break;
          }

          case "resend_email": {
            const rawTo = getNodeDataString(node, "to", "{{steps.trigger-1.email}}");
            const rawSubject = getNodeDataString(node, "subject", DEFAULT_RESEND_SUBJECT);
            const bodyText = resolveSanitizedEmailBody(node, sortedNodes, context);

            const to = interpolate(rawTo, context) || testEmail;
            const subject = interpolate(rawSubject, context);

            const result = await runResend(keys, to, subject, bodyText);
            context[node.id] = result;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] resend_email`, result);
            stepResult = result;
            break;
          }

          default: {
            context[node.id] = {
              skipped: true,
              reason: `Unknown node type: ${nodeType}`,
            };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "skipped" });
            console.warn(`[${node.id}] Skipping unknown type: ${nodeType}`);
            stepResult = context[node.id];
            break;
          }
        }

        await insertStepLog(supabaseAdmin, {
          executionId,
          clientId,
          eventType: "STEP_COMPLETE",
          nodeId: node.id,
          nodeType,
          result: stepResult,
        });
      } catch (stepError: unknown) {
        const message = stepError instanceof Error ? stepError.message : "Unknown step error";
        context[node.id] = { error: message };
        executionLog.push({ nodeId: node.id, type: nodeType, status: "error" });
        console.error(`[${node.id}] ${nodeType} failed:`, message);

        await insertStepLog(supabaseAdmin, {
          executionId,
          clientId,
          eventType: "STEP_COMPLETE",
          nodeId: node.id,
          nodeType,
          result: { error: message },
        });
        throw stepError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        context,
        executionLog,
        executionId,
        sortedNodeIds: sortedNodes.map((n) => n.id),
        safemode: { testEmail, apolloLive: useLiveApollo },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[RUN OUTBOUND ERROR]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
