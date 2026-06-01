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
const DEFAULT_RESEND_BODY = "{{steps.LLM_NODE.copy}}\n\nLet's chat.\n- Damilare";

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
        id: "email-1",
        type: "resend_email",
        data: {
          to: "{{steps.trigger-1.email}}",
          subject: DEFAULT_RESEND_SUBJECT.replace(/APOLLO_NODE/g, "apollo-1"),
          body: DEFAULT_RESEND_BODY.replace(/LLM_NODE/g, "llm-1").replace(
            /APOLLO_NODE/g,
            "apollo-1",
          ),
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "apollo-1" },
      { id: "e2", source: "apollo-1", target: "llm-1" },
      { id: "e3", source: "llm-1", target: "email-1" },
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

  const searchData = (await parseJsonResponse(searchResponse, "apollo_search")) as {
    people?: Array<{ id?: string }>;
  };

  const firstPerson = searchData.people?.[0];
  if (!firstPerson?.id) {
    throw new Error("apollo_search: No person id in search results");
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

  const enrichData = (await parseJsonResponse(enrichResponse, "apollo_enrich")) as {
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
}

async function runDeepseek(
  keys: VaultKeys,
  prompt: string,
): Promise<{ copy: string; prompt: string }> {
  const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.deepseek_api_key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are an elite B2B copywriter." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const deepseekData = (await parseJsonResponse(deepseekResponse, "deepseek_llm")) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const copy = deepseekData.choices?.[0]?.message?.content?.trim() ?? "";
  if (!copy) throw new Error("deepseek_llm: Empty completion content");

  return { copy, prompt };
}

async function runResend(
  keys: VaultKeys,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<{ messageId: string; to: string; subject: string }> {
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
      html: htmlBody,
    }),
  });

  const resendData = (await parseJsonResponse(resendResponse, "resend_email")) as {
    id?: string;
  };

  if (!resendData.id) throw new Error("resend_email: Missing message id in response");

  return { messageId: resendData.id, to, subject };
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

    const context: ExecutionContext = {};
    const sortedNodes = sortNodesByEdges(nodes, edges);
    const executionLog: Array<{ nodeId: string; type: string; status: string }> = [];

    console.info(
      "[run-outbound] Execution order:",
      sortedNodes.map((n) => `${n.id}:${n.type}`).join(" -> "),
    );

    for (const node of sortedNodes) {
      const nodeType = node.type === "tool" ? getNodeDataString(node, "executor", node.type) : node.type;

      try {
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
            break;
          }

          case "apollo_search": {
            const lead = await runApolloSearch(keys, testEmail, useLiveApollo);
            const safemodeLead = { ...lead, email: testEmail };
            context[node.id] = safemodeLead;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] apollo_search`, safemodeLead);
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
            break;
          }

          case "resend_email": {
            const rawTo = getNodeDataString(node, "to", "{{steps.trigger-1.email}}");
            const rawSubject = getNodeDataString(node, "subject", DEFAULT_RESEND_SUBJECT);
            const rawBody =
              getNodeDataString(node, "body") ||
              getNodeDataString(node, "html") ||
              DEFAULT_RESEND_BODY;

            const to = interpolate(rawTo, context) || testEmail;
            const subject = interpolate(rawSubject, context);
            const bodyText = interpolate(rawBody, context);
            const htmlBody = bodyText.replace(/\n/g, "<br>");

            const result = await runResend(keys, to, subject, htmlBody);
            context[node.id] = result;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] resend_email`, result);
            break;
          }

          default: {
            context[node.id] = {
              skipped: true,
              reason: `Unknown node type: ${nodeType}`,
            };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "skipped" });
            console.warn(`[${node.id}] Skipping unknown type: ${nodeType}`);
            break;
          }
        }
      } catch (stepError: unknown) {
        const message = stepError instanceof Error ? stepError.message : "Unknown step error";
        context[node.id] = { error: message };
        executionLog.push({ nodeId: node.id, type: nodeType, status: "error" });
        console.error(`[${node.id}] ${nodeType} failed:`, message);
        throw stepError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        context,
        executionLog,
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
