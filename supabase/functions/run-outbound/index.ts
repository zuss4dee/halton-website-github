import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  formatMissingVaultKeyError,
  resolveVaultKeys,
  type VaultKeys,
} from "../_shared/vaultKeys.ts";
import {
  interpolateLeadMergeVariables,
  leadRowToMergeFields,
  mergeLeadMergeFields,
  personalizeOutboundEmailContent,
  type LeadMergeFields,
} from "../_shared/leadMergeVariables.ts";
import { appendOutboundFounderSignature } from "../_shared/outboundSignature.ts";
import { resolveOutboundFromEmail } from "../_shared/resolveOutboundFrom.ts";
import { resolveInboundReplyToAddress } from "../_shared/inboundReplyTo.ts";
import {
  buildExecutiveOverrideNodeOutput,
  shouldReusePriorContext,
} from "../_shared/executiveOverride.ts";
import {
  normalizeResearchUrl,
  pickResearchUrlFromLead,
  scrapeUrlWithFirecrawl,
} from "../_shared/firecrawlScrape.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workflow-type",
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
  website?: string;
  research_url?: string;
  linkedin_url?: string;
};

type ExecutionContext = Record<string, unknown>;

type ApprovalQueueStatus =
  | "pending"
  | "approved"
  | "needs_human_review"
  | "qa_rejected";

type QaEvaluationResult = {
  queueStatus: ApprovalQueueStatus;
  violations: string[];
  source: string;
};

const SPAM_TRIGGER_PATTERN =
  /\b(free|guarantee|act now|limited time|click here|buy now|urgent|winner|congratulations|100%|no risk)\b/i;
const PLACEHOLDER_PATTERN = /\[(Your Name|Name|Company|Insert)\]/i;

const QA_LEAD_FALLBACK_PROMPT = `You are the QA Lead — brand and compliance reviewer for outbound cold email.

Evaluate the sanitized email BODY against brand guidelines. Return ONLY valid JSON (no markdown):
{"verdict":"approved"|"qa_rejected"|"needs_human_review","violations":["reason 1"]}

Rules:
- approved: no banned/spam words, correct casual B2B tone, max 3 sentences, no sender sign-off in body (signature added later), no placeholders, no subject line in body
- qa_rejected: clear violations (spam triggers, wrong tone, placeholders, subject in body, too long)
- needs_human_review: ambiguous edge cases or uncertain brand fit`;

const DEFAULT_DEEPSEEK_PROMPT =
  "Write a casual 2-3 sentence cold email to {{steps.APOLLO_NODE.first_name}}, the {{steps.APOLLO_NODE.title}} at {{steps.APOLLO_NODE.company}}. Use ONE plain-English observation from this research about what their company does (no jargon stacks, no invented stats): {{steps.RESEARCH_NODE.brief}}. Then ask if they are open to a 15-minute call. Do NOT include your name, sign-off, or signature — that is added automatically. If research is empty, mention their company and role only. Write like a founder texting another founder.";

const DEFAULT_RESEARCH_CONDENSER_PROMPT = `You condense scraped company web content into a short research brief for cold email personalization.
Output plain English only (2-3 short sentences). Say what the company sells and who they sell to in words a non-technical founder would use.
Never invent stats. Never use bullet points or markdown. Keep it under 60 words.`;

const DEFAULT_RESEARCH_AGENT_ROLE = "COMPANY_RESEARCHER";

const DEFAULT_APOLLO_TITLES = ["Founder", "CEO", "Co-Founder"];
const DEFAULT_APOLLO_LOCATIONS = ["United Kingdom", "United States"];

const DEFAULT_RESEND_SUBJECT = "Quick question for {{company_name}}";
const DEFAULT_RESEND_BODY = "{{steps.REVIEWER_NODE.copy}}\n\nLet's chat.\n- Damilare";

/** Sandbox mode: all outbound sends route here during testing — never to real leads. */
const SANDBOX_TO_EMAIL = "adedamilare1@gmail.com";

function isOutboundSandbox(): boolean {
  return Deno.env.get("OUTBOUND_SANDBOX")?.trim().toLowerCase() === "true";
}

function resolveOutboundSendTarget(intendedRecipient: string): {
  to: string;
  subjectPrefix: string;
  sandbox: boolean;
} {
  if (isOutboundSandbox()) {
    return {
      to: SANDBOX_TO_EMAIL,
      subjectPrefix: `[SANDBOX: ${intendedRecipient}] `,
      sandbox: true,
    };
  }
  return { to: intendedRecipient, subjectPrefix: "", sandbox: false };
}

async function loadOutboundFromEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("company_name, sending_domain, primary_contact_email")
    .eq("id", clientId)
    .maybeSingle();

  if (!data) return null;
  return resolveOutboundFromEmail(data);
}

const NO_DASH_RULE =
  'Never use em dashes (—), en dashes (–), or a hyphen surrounded by spaces ( - ) as punctuation. Rewrite with commas, periods, or parentheses instead. Hyphenated words like "15-minute" are fine.';

const DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS = `STRICT NEGATIVE CONSTRAINTS (violating any rule = failed output):
1. FATAL ERROR IF: You include the word "Subject:" or the actual subject line in your output. Output ONLY the body copy.
2. FATAL ERROR IF: The text is longer than 3 sentences. You MUST use heavy line breaks between sentences.
3. FATAL ERROR IF: You use placeholders like [Your Name].
4. FATAL ERROR IF: You include ANY sender sign-off or sender name (Best, Regards, Damilare, Damilare Adeosun). Signature is appended automatically.
5. FATAL ERROR IF: You invent or swap prospect names. Check the prospect's actual name in the user message (draft). Do not hallucinate names like "Mark" if the draft uses a different name.
6. FATAL ERROR IF: You use em dashes (—), en dashes (–), or spaced hyphens ( - ) as punctuation. ${NO_DASH_RULE}`;

const DELIVERABILITY_CHIEF_FALLBACK_PROMPT = `You are the DELIVERABILITY_CHIEF — a draconian cold-email deliverability critic.

Your job is to rewrite the draft email BODY so it passes spam filters and lands in the primary inbox.

Operational rules:
- Remove spam trigger words (free, guarantee, act now, limited time, etc.)
- No ALL CAPS, excessive punctuation, or misleading hooks
- Preserve the core intent and CTA from the draft
- Do not add links unless the draft already had them
- Maximum 3 sentences total, each on its own line with heavy line breaks
- Rewrite jargon or invented stats into plain English a busy founder understands
- Do NOT include a sign-off or sender name — signature is appended automatically
- Return ONLY the sanitized email body — no preamble, quotes, labels, markdown fences, or subject line

${DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS}`;

const DELIVERABILITY_CHIEF_ROLE = "DELIVERABILITY_CHIEF";
const QA_LEAD_ROLE = "QA_LEAD";
const DEFAULT_DEEPSEEK_WRITER_ROLE = "DEEPSEEK_WRITER";
const DEFAULT_COPYWRITER_SYSTEM = "You are an elite B2B copywriter.";

type AgentDbRow = {
  id: string;
  role: string;
  model: string | null;
  temperature: number | null;
  system_prompt: string | null;
  tool_bindings: unknown;
  skills: unknown;
  reasoning_config: unknown;
  is_active: boolean | null;
  client_id: string | null;
};

type AgentRuntimeConfig = {
  agentId: string | null;
  role: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  toolBindings: string[];
  reasoningConfig: Record<string, unknown>;
};

const AGENT_RUNTIME_SELECT =
  "id, role, model, temperature, system_prompt, tool_bindings, skills, reasoning_config, is_active, client_id";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function normalizeReasoningConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function resolveEdgeModel(storedModel: string | null | undefined): string {
  const model = (storedModel ?? "deepseek-chat").trim();
  if (model.startsWith("deepseek")) return model;
  console.warn(
    `[llm] Model "${model}" is not available in edge vault; routing via deepseek-chat`,
  );
  return "deepseek-chat";
}

async function fetchAgentRuntimeConfig(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  options: { agentId?: string; role?: string },
): Promise<AgentRuntimeConfig> {
  const workspaceClientId = clientId.trim();
  let row: AgentDbRow | null = null;

  if (options.agentId?.trim()) {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select(AGENT_RUNTIME_SELECT)
      .eq("id", options.agentId.trim())
      .maybeSingle();

    if (error) {
      console.warn("[fetchAgentRuntimeConfig] by id:", error.message);
    } else if (data) {
      const candidate = data as AgentDbRow;
      if (!candidate.client_id || candidate.client_id === workspaceClientId) {
        row = candidate;
      }
    }
  }

  if (!row && options.role?.trim()) {
    const normalized = options.role.trim().toUpperCase().replace(/\s+/g, "_");

    const { data: scoped } = await supabaseAdmin
      .from("agents")
      .select(AGENT_RUNTIME_SELECT)
      .eq("role", normalized)
      .eq("client_id", workspaceClientId)
      .maybeSingle();

    if (scoped) {
      row = scoped as AgentDbRow;
    } else {
      const { data: global } = await supabaseAdmin
        .from("agents")
        .select(AGENT_RUNTIME_SELECT)
        .eq("role", normalized)
        .is("client_id", null)
        .maybeSingle();

      if (global) row = global as AgentDbRow;
    }
  }

  if (!row) {
    return {
      agentId: null,
      role: options.role ?? "UNKNOWN",
      model: "deepseek-chat",
      temperature: 0.7,
      systemPrompt: DEFAULT_COPYWRITER_SYSTEM,
      toolBindings: [],
      reasoningConfig: {},
    };
  }

  if (row.is_active === false) {
    throw new Error(`Agent ${row.role} is inactive and cannot run in workflows.`);
  }

  const bindings = parseStringArray(row.tool_bindings);
  const skills = parseStringArray(row.skills);

  return {
    agentId: row.id,
    role: row.role,
    model: resolveEdgeModel(row.model),
    temperature:
      typeof row.temperature === "number" && Number.isFinite(row.temperature)
        ? row.temperature
        : 0.7,
    systemPrompt: row.system_prompt?.trim() || DEFAULT_COPYWRITER_SYSTEM,
    toolBindings: bindings.length > 0 ? bindings : skills,
    reasoningConfig: normalizeReasoningConfig(row.reasoning_config),
  };
}

function buildRuntimeSystemPrompt(config: AgentRuntimeConfig, fallback: string): string {
  const base = config.systemPrompt.trim() || fallback;
  const extra = config.reasoningConfig.instructions;
  if (typeof extra === "string" && extra.trim()) {
    return `${base}\n\n${extra.trim()}`;
  }
  return base;
}

function applyDeliverabilityChiefConstraints(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return DELIVERABILITY_CHIEF_FALLBACK_PROMPT;
  // DB-seeded prompts may predate the dash ban — always enforce it.
  const withDashRule = trimmed.includes("em dash")
    ? trimmed
    : `${trimmed}\n\n${NO_DASH_RULE}`;
  if (withDashRule.includes("FATAL ERROR IF:")) return withDashRule;
  return `${withDashRule}\n\n${DELIVERABILITY_CHIEF_FATAL_CONSTRAINTS}`;
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

function findApolloLeadContext(
  sortedNodes: FlowNode[],
  context: ExecutionContext,
): Record<string, unknown> | null {
  for (const node of sortedNodes) {
    if (node.type !== "apollo_search") continue;
    const output = context[node.id];
    if (output && typeof output === "object" && !Array.isArray(output)) {
      return output as Record<string, unknown>;
    }
  }
  return null;
}

function resolveResearchTargetUrl(
  node: FlowNode,
  context: ExecutionContext,
  sortedNodes: FlowNode[],
): string {
  const urlTemplate = getNodeDataString(node, "url");
  const interpolated = urlTemplate ? interpolate(urlTemplate, context).trim() : "";
  const normalizedInterpolated = normalizeResearchUrl(interpolated);
  if (normalizedInterpolated) return normalizedInterpolated;

  const apolloLead = findApolloLeadContext(sortedNodes, context);
  if (apolloLead) {
    return pickResearchUrlFromLead(apolloLead);
  }

  return "";
}

function findResearchBriefFromContext(
  sortedNodes: FlowNode[],
  context: ExecutionContext,
): { brief: string; url: string } {
  for (const node of sortedNodes) {
    if (node.type !== "agent_research") continue;
    const output = context[node.id];
    if (!output || typeof output !== "object" || Array.isArray(output)) continue;
    const record = output as Record<string, unknown>;
    return {
      brief: typeof record.brief === "string" ? record.brief : "",
      url: typeof record.url === "string" ? record.url : "",
    };
  }
  return { brief: "", url: "" };
}

async function runAgentResearch(
  keys: VaultKeys,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  node: FlowNode,
  context: ExecutionContext,
  sortedNodes: FlowNode[],
): Promise<Record<string, unknown>> {
  const targetUrl = resolveResearchTargetUrl(node, context, sortedNodes);
  const apolloLead = findApolloLeadContext(sortedNodes, context);
  const company =
    typeof apolloLead?.company === "string" ? apolloLead.company : "the company";

  if (!targetUrl) {
    console.warn(`[${node.id}] agent_research skipped — no URL on lead`);
    return {
      brief: "",
      url: "",
      skipped: true,
      reason: "no_url",
      company,
    };
  }

  if (!keys.firecrawl_api_key) {
    console.warn(`[${node.id}] agent_research skipped — missing firecrawl_api_key`);
    return {
      brief: "",
      url: targetUrl,
      skipped: true,
      reason: "missing_firecrawl_key",
      company,
    };
  }

  let markdown = "";
  try {
    const scrape = await scrapeUrlWithFirecrawl(keys.firecrawl_api_key, targetUrl);
    markdown = scrape.markdown.slice(0, 12000);
    console.info(`[${node.id}] agent_research scraped ${targetUrl} (${markdown.length} chars)`);
  } catch (scrapeError) {
    const message = scrapeError instanceof Error ? scrapeError.message : String(scrapeError);
    console.error(`[${node.id}] agent_research scrape failed:`, message);
    return {
      brief: "",
      url: targetUrl,
      skipped: true,
      reason: "scrape_failed",
      error: message.slice(0, 300),
      company,
    };
  }

  const taskInstruction = getNodeDataString(node, "task");
  const agentId = getNodeDataString(node, "agentId");
  const agentRole = getNodeDataString(node, "agentRole") || DEFAULT_RESEARCH_AGENT_ROLE;

  const runtime = await fetchAgentRuntimeConfig(supabaseAdmin, clientId, {
    agentId: agentId || undefined,
    role: agentId ? undefined : agentRole,
  });

  const condenseSystem =
    runtime.systemPrompt.trim() || DEFAULT_RESEARCH_CONDENSER_PROMPT;
  const condenseConfig: AgentRuntimeConfig = {
    ...runtime,
    systemPrompt: condenseSystem,
  };

  const userPrompt = [
    `Company: ${company}`,
    `Source URL: ${targetUrl}`,
    taskInstruction ? `Task: ${taskInstruction}` : "",
    "",
    "Scraped content:",
    markdown,
  ]
    .filter(Boolean)
    .join("\n");

  let brief = "";
  try {
    brief = await runLlmCompletion(keys, condenseConfig, userPrompt, "agent_research");
  } catch (condenseError) {
    const message = condenseError instanceof Error ? condenseError.message : String(condenseError);
    console.error(`[${node.id}] agent_research condense failed:`, message);
    brief = markdown.slice(0, 800);
  }

  return {
    brief: brief.trim(),
    url: targetUrl,
    skipped: false,
    company,
    agentId: runtime.agentId,
  };
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

/** Subject: merge tags first, then DAG step refs, then merge again (matches body tag handling). */
function personalizeSubjectForSend(
  rawSubject: string,
  context: ExecutionContext,
  mergeFields: LeadMergeFields,
): string {
  let subject = interpolateLeadMergeVariables(rawSubject, mergeFields);
  subject = interpolate(subject, context);
  return interpolateLeadMergeVariables(subject, mergeFields);
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

function pickNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/** Normalize company from Apollo, CRM fetch, trigger payload, or node data. */
function readLeadCompanyFromRecord(record: unknown): string | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }
  const row = record as Record<string, unknown>;
  return pickNonEmptyString(row.target_company, row.company, row.company_name);
}

function resolveQueueLeadProfile(
  context: ExecutionContext,
  sortedNodes: FlowNode[],
  testEmail: string,
): {
  email: string;
  prospect_name: string;
  target_company: string | null;
  target_role: string | null;
} {
  const apolloLead = findApolloLead(context, sortedNodes);
  const triggerNode = sortedNodes.find((candidate) => candidate.type === "trigger");
  const triggerCtx =
    triggerNode &&
    context[triggerNode.id] &&
    typeof context[triggerNode.id] === "object" &&
    !Array.isArray(context[triggerNode.id])
      ? (context[triggerNode.id] as Record<string, unknown>)
      : null;
  const triggerData = triggerNode?.data ?? null;

  const email =
    pickNonEmptyString(apolloLead?.email, triggerCtx?.email, triggerCtx?.testEmail) ||
    (triggerNode ? getNodeDataString(triggerNode, "email") : "") ||
    testEmail;

  let target_company =
    readLeadCompanyFromRecord(apolloLead) ||
    readLeadCompanyFromRecord(triggerCtx) ||
    readLeadCompanyFromRecord(triggerData);

  if (!target_company) {
    for (const node of sortedNodes) {
      target_company = readLeadCompanyFromRecord(context[node.id]);
      if (target_company) break;
    }
  }

  const firstName =
    pickNonEmptyString(apolloLead?.first_name, triggerCtx?.first_name) ||
    (triggerNode ? getNodeDataString(triggerNode, "first_name") : null);
  const lastName =
    pickNonEmptyString(apolloLead?.last_name, triggerCtx?.last_name) ||
    (triggerNode ? getNodeDataString(triggerNode, "last_name") : null);
  const prospect_name =
    pickNonEmptyString(
      firstName && lastName ? `${firstName} ${lastName}` : null,
      firstName,
      triggerCtx?.prospect_name,
    ) || "Prospect";

  const target_role =
    pickNonEmptyString(
      apolloLead?.title,
      triggerCtx?.title,
      triggerCtx?.target_role,
    ) ||
    (triggerNode
      ? getNodeDataString(triggerNode, "title") ||
        getNodeDataString(triggerNode, "target_role")
      : null);

  return {
    email,
    prospect_name,
    target_company,
    target_role,
  };
}

async function resolveTargetCompanyForQueueInsert(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  queueLead: ReturnType<typeof resolveQueueLeadProfile>,
): Promise<string | null> {
  if (queueLead.target_company) {
    return queueLead.target_company;
  }

  const fromDb = await fetchLeadMergeFieldsFromDb(
    supabaseAdmin,
    clientId,
    queueLead.email,
  );
  if (!fromDb) {
    return null;
  }

  return (
    pickNonEmptyString(fromDb.target_company, fromDb.company, fromDb.company_name) ??
    null
  );
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
      {
        id: "apollo-1",
        type: "apollo_search",
        data: {
          label: "[ APOLLO ] - Search & Enrich Lead",
          location: DEFAULT_APOLLO_LOCATIONS.join(", "),
          title: DEFAULT_APOLLO_TITLES.join(", "),
        },
      },
      {
        id: "research-1",
        type: "agent_research",
        data: {
          label: "Company Research",
          url: "{{steps.apollo-1.website}}",
          task:
            "Summarize what the company sells, who they serve, and one specific outreach hook. Use only facts from the scrape.",
        },
      },
      {
        id: "llm-1",
        type: "deepseek_llm",
        data: {
          prompt: DEFAULT_DEEPSEEK_PROMPT.replace(/APOLLO_NODE/g, "apollo-1").replace(
            /RESEARCH_NODE/g,
            "research-1",
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
      { id: "e1b", source: "apollo-1", target: "research-1" },
      { id: "e2", source: "research-1", target: "llm-1" },
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

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveApolloSearchFilters(node: FlowNode): {
  personTitles: string[];
  personLocations: string[];
} {
  const titleRaw = getNodeDataString(node, "title");
  const locationRaw = getNodeDataString(node, "location");

  const personTitles = titleRaw
    ? parseCommaSeparatedList(titleRaw)
    : DEFAULT_APOLLO_TITLES;
  const personLocations = locationRaw
    ? parseCommaSeparatedList(locationRaw)
    : DEFAULT_APOLLO_LOCATIONS;

  return { personTitles, personLocations };
}

function apolloSearchError(response: Response | null, reason?: string): Error {
  if (response?.status === 403) {
    return new Error(
      "[apollo_search] Apollo API returned 403 — check API key tier and credits. Pipeline halted (no mock fallback in production).",
    );
  }

  const status = response ? `HTTP ${response.status}` : reason ?? "request failed";
  return new Error(`[apollo_search] ${status}. Pipeline halted (no mock fallback in production).`);
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
  node: FlowNode,
): Promise<EnrichedTarget> {
  if (!useLiveApollo) {
    const mock: EnrichedTarget = {
      apollo_person_id: "mock-person-id",
      email: testEmail,
      first_name: "James",
      last_name: "Bond",
      title: "CEO",
      company: "Example SaaS Co",
      website: "https://example.com",
    };
    console.info("[apollo_search] MOCK lead (safemode — no Apollo key):", mock);
    return mock;
  }

  const { personTitles, personLocations } = resolveApolloSearchFilters(node);
  console.info("[apollo_search] filters", { personTitles, personLocations });

  const searchResponse = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "x-api-key": keys.apollo_api_key!,
    },
    body: JSON.stringify({
      person_titles: personTitles,
      person_locations: personLocations,
      per_page: 1,
    }),
  });

  if (!searchResponse.ok) {
    throw apolloSearchError(searchResponse);
  }

  const searchData = (await parseJsonBody(searchResponse)) as {
    people?: Array<{ id?: string }>;
  };

  const firstPerson = searchData.people?.[0];
  if (!firstPerson?.id) {
    throw new Error(
      "[apollo_search] No matching prospects for configured ICP filters. Pipeline halted.",
    );
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
    throw apolloSearchError(enrichResponse);
  }

  const enrichData = (await parseJsonBody(enrichResponse)) as {
    person?: Record<string, unknown>;
  };

  const person = enrichData.person ?? (enrichData as Record<string, unknown>);
  const org = person.organization as {
    name?: string;
    website_url?: string;
    primary_domain?: string;
  } | undefined;

  const websiteRaw =
    (typeof org?.website_url === "string" ? org.website_url : "") ||
    (typeof org?.primary_domain === "string" ? org.primary_domain : "") ||
    (typeof person.website_url === "string" ? person.website_url : "");

  const website = normalizeResearchUrl(websiteRaw) ?? "";

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
    ...(website ? { website } : {}),
    ...(typeof person.linkedin_url === "string" && person.linkedin_url.trim()
      ? { linkedin_url: person.linkedin_url.trim() }
      : {}),
  };
}

async function runLlmCompletion(
  keys: VaultKeys,
  config: AgentRuntimeConfig,
  userContent: string,
  stepLabel: string,
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: userContent },
    ],
  };

  if (typeof config.reasoningConfig.max_tokens === "number") {
    requestBody.max_tokens = config.reasoningConfig.max_tokens;
  }

  if (typeof config.reasoningConfig.top_p === "number") {
    requestBody.top_p = config.reasoningConfig.top_p;
  }

  const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.deepseek_api_key}`,
    },
    body: JSON.stringify(requestBody),
  });

  const deepseekData = (await parseJsonResponse(deepseekResponse, stepLabel)) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const copy = deepseekData.choices?.[0]?.message?.content?.trim() ?? "";
  if (!copy) throw new Error(`${stepLabel}: Empty completion content`);

  return copy;
}

async function runDeepseekWithAgent(
  keys: VaultKeys,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  node: FlowNode,
  userPrompt: string,
): Promise<{ copy: string; prompt: string; agentId: string | null }> {
  const agentId = getNodeDataString(node, "agentId");
  const agentRole = getNodeDataString(node, "agentRole") || DEFAULT_DEEPSEEK_WRITER_ROLE;

  const runtime = await fetchAgentRuntimeConfig(supabaseAdmin, clientId, {
    agentId: agentId || undefined,
    role: agentId ? undefined : agentRole,
  });

  const baseSystemPrompt = buildRuntimeSystemPrompt(runtime, DEFAULT_COPYWRITER_SYSTEM);
  const systemPrompt = baseSystemPrompt.includes("em dash")
    ? baseSystemPrompt
    : `${baseSystemPrompt}\n\n${NO_DASH_RULE}`;
  const llmConfig: AgentRuntimeConfig = { ...runtime, systemPrompt };

  console.info(
    `[deepseek_llm] agent=${runtime.role} model=${llmConfig.model} temp=${llmConfig.temperature} tools=${llmConfig.toolBindings.join(",") || "none"}`,
  );

  const copy = await runLlmCompletion(keys, llmConfig, userPrompt, "deepseek_llm");
  return { copy, prompt: userPrompt, agentId: runtime.agentId };
}

async function fetchDeliverabilityChiefRuntime(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  node: FlowNode,
): Promise<AgentRuntimeConfig> {
  const agentId = getNodeDataString(node, "agentId");

  const runtime = await fetchAgentRuntimeConfig(supabaseAdmin, clientId, {
    agentId: agentId || undefined,
    role: agentId ? undefined : DELIVERABILITY_CHIEF_ROLE,
  });

  const systemPrompt = applyDeliverabilityChiefConstraints(
    buildRuntimeSystemPrompt(runtime, DELIVERABILITY_CHIEF_FALLBACK_PROMPT),
  );

  return { ...runtime, systemPrompt };
}

const SIGNATURE_LINE_PATTERN = /^[\s—–-]*(best|regards|cheers|thanks)?[,\s]*Damilare(\s+Adeosun)?[\s.,!]*$/i;
const GREETING_LINE_PATTERN = /^(hey|hi|hello|dear)\b[^.!?]{0,60},?\s*$/i;

/** Body without greeting/signature lines — only real sentences count toward the limit. */
function extractCountableBody(copy: string): string {
  const lines = copy.trim().split(/\r?\n/);
  const kept = lines.filter((line) => {
    const candidate = line.trim();
    if (!candidate) return false;
    if (SIGNATURE_LINE_PATTERN.test(candidate)) return false;
    if (GREETING_LINE_PATTERN.test(candidate)) return false;
    return true;
  });
  return kept.join("\n");
}

function collectHeuristicQaViolations(copy: string): string[] {
  const violations: string[] = [];
  const trimmed = copy.trim();
  if (!trimmed) violations.push("Empty email body");
  if (SPAM_TRIGGER_PATTERN.test(trimmed)) {
    violations.push("Contains spam trigger words");
  }
  if (PLACEHOLDER_PATTERN.test(trimmed)) {
    violations.push("Contains placeholder text");
  }
  if (/^Subject:/im.test(trimmed)) {
    violations.push("Subject line included in body");
  }
  const countableBody = extractCountableBody(trimmed);
  const sentenceCount = countableBody
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  if (sentenceCount > 3) {
    violations.push("Exceeds 3 sentence limit");
  }
  if (/[—–]/.test(countableBody) || /\S\s+-\s+\S/.test(countableBody)) {
    violations.push("Uses dash punctuation (em/en dash or spaced hyphen)");
  }
  if (/\bDamilare(\s+Adeosun)?\b/i.test(countableBody)) {
    violations.push("Sender name in body (signature is appended automatically)");
  }
  return violations;
}

async function fetchClientBrandContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("tone_of_voice, target_icp, core_offer")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) return "";

  const parts: string[] = [];
  if (typeof data.tone_of_voice === "string" && data.tone_of_voice.trim()) {
    parts.push(`Brand tone: ${data.tone_of_voice.trim()}`);
  }
  if (typeof data.target_icp === "string" && data.target_icp.trim()) {
    parts.push(`Target ICP: ${data.target_icp.trim()}`);
  }
  if (typeof data.core_offer === "string" && data.core_offer.trim()) {
    parts.push(`Core offer: ${data.core_offer.trim()}`);
  }

  return parts.length > 0 ? `\n\nClient brand context:\n${parts.join("\n")}` : "";
}

function parseQaVerdictJson(raw: string): {
  verdict: ApprovalQueueStatus;
  violations: string[];
} | null {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      verdict?: string;
      violations?: unknown;
    };
    const verdict = parsed.verdict;
    const violations = Array.isArray(parsed.violations)
      ? parsed.violations.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (
      verdict === "approved" ||
      verdict === "qa_rejected" ||
      verdict === "needs_human_review" ||
      verdict === "pending"
    ) {
      return { verdict, violations };
    }
  } catch {
    return null;
  }
  return null;
}

async function runQaLeadEvaluation(
  keys: VaultKeys,
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  sanitizedCopy: string,
  deliverabilityChiefRuntime: AgentRuntimeConfig,
): Promise<QaEvaluationResult> {
  const heuristicViolations = collectHeuristicQaViolations(sanitizedCopy);
  if (heuristicViolations.length > 0) {
    return {
      queueStatus: "qa_rejected",
      violations: heuristicViolations,
      source: "qa_heuristic",
    };
  }

  let qaRuntime = await fetchAgentRuntimeConfig(supabaseAdmin, clientId, {
    role: QA_LEAD_ROLE,
  });
  if (!qaRuntime.agentId) {
    qaRuntime = deliverabilityChiefRuntime;
  }

  const brandContext = await fetchClientBrandContext(supabaseAdmin, clientId);
  const qaSystem = `${buildRuntimeSystemPrompt(qaRuntime, QA_LEAD_FALLBACK_PROMPT)}${brandContext}`;
  const qaConfig: AgentRuntimeConfig = { ...qaRuntime, systemPrompt: qaSystem };

  console.info(
    `[qa_lead] agent=${qaConfig.role} model=${qaConfig.model} evaluating copy length=${sanitizedCopy.length}`,
  );

  const rawVerdict = await runLlmCompletion(
    keys,
    qaConfig,
    `Evaluate this sanitized email body:\n\n${sanitizedCopy}`,
    "qa_evaluation",
  );

  const parsed = parseQaVerdictJson(rawVerdict);
  if (!parsed) {
    return {
      queueStatus: "needs_human_review",
      violations: ["QA agent returned unparseable verdict"],
      source: "qa_lead_fallback",
    };
  }

  if (parsed.verdict === "approved") {
    return { queueStatus: "approved", violations: [], source: "qa_lead" };
  }
  if (parsed.verdict === "qa_rejected") {
    return {
      queueStatus: "qa_rejected",
      violations: parsed.violations.length > 0 ? parsed.violations : ["QA rejected copy"],
      source: "qa_lead",
    };
  }

  return {
    queueStatus: parsed.verdict === "pending" ? "pending" : "needs_human_review",
    violations: parsed.violations,
    source: "qa_lead",
  };
}

async function assertLeadApprovedForSend(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  email: string,
): Promise<{ approved: boolean; queueStatus: string | null }> {
  const { data: leadRow, error } = await supabaseAdmin
    .from("leads")
    .select("queue_status")
    .eq("client_id", clientId)
    .eq("email", email.trim())
    .maybeSingle();

  if (error) {
    console.warn("[approval_gate] lead status lookup failed:", error.message);
    return { approved: false, queueStatus: null };
  }

  return {
    approved: leadRow?.queue_status === "approved",
    queueStatus: (leadRow?.queue_status as string | null) ?? null,
  };
}

async function fetchLeadMergeFieldsFromDb(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  email: string,
): Promise<LeadMergeFields | null> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("prospect_name, target_company, target_role, email, form_data")
    .eq("client_id", clientId)
    .eq("email", email.trim())
    .maybeSingle();

  if (error || !data) return null;
  return leadRowToMergeFields(data as Record<string, unknown>);
}

function mergeFieldsFromExecutionContext(
  context: ExecutionContext,
  sortedNodes: FlowNode[],
  recipientEmail: string,
): LeadMergeFields {
  const apolloLead = findApolloLead(context, sortedNodes);
  const triggerNode = sortedNodes.find((candidate) => candidate.type === "trigger");
  const triggerCtx =
    triggerNode &&
    context[triggerNode.id] &&
    typeof context[triggerNode.id] === "object"
      ? (context[triggerNode.id] as Record<string, unknown>)
      : null;

  const firstName =
    apolloLead?.first_name ??
    (typeof triggerCtx?.first_name === "string" ? triggerCtx.first_name : undefined);
  const lastName =
    apolloLead?.last_name ??
    (typeof triggerCtx?.last_name === "string" ? triggerCtx.last_name : undefined);
  const company =
    apolloLead?.company ??
    (typeof triggerCtx?.company === "string" ? triggerCtx.company : undefined);
  const title =
    apolloLead?.title ??
    (typeof triggerCtx?.title === "string" ? triggerCtx.title : undefined);

  const prospectName =
    firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || undefined;

  return {
    first_name: firstName,
    last_name: lastName,
    prospect_name: prospectName,
    company,
    target_company: company,
    target_role: title,
    title,
    email: recipientEmail,
  };
}

async function resolveLeadMergeFieldsForSend(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  recipientEmail: string,
  context?: ExecutionContext,
  sortedNodes?: FlowNode[],
): Promise<LeadMergeFields> {
  const fromContext =
    context && sortedNodes
      ? mergeFieldsFromExecutionContext(context, sortedNodes, recipientEmail)
      : { email: recipientEmail };

  const fromDb = await fetchLeadMergeFieldsFromDb(supabaseAdmin, clientId, recipientEmail);
  return mergeLeadMergeFields(fromDb, fromContext);
}

async function runResend(
  keys: VaultKeys,
  from: string,
  to: string,
  subject: string,
  textBody: string,
  meta?: { nodeId?: string; intendedRecipient?: string; mergeFields?: LeadMergeFields },
): Promise<{ messageId: string; to: string; subject: string; format: "text" }> {
  const personalized = meta?.mergeFields
    ? personalizeOutboundEmailContent(subject, textBody, meta.mergeFields)
    : { subject, body: textBody };
  const signedBody = appendOutboundFounderSignature(personalized.body);
  const replyTo = resolveInboundReplyToAddress();
  const requestBody: Record<string, unknown> = {
    from,
    to,
    subject: personalized.subject,
    text: signedBody,
    tags: [{ name: "category", value: "cold_outreach" }],
    headers: {
      "X-Resend-Open-Tracking": "false",
      "X-Resend-Click-Tracking": "false",
    },
  };
  if (replyTo) {
    requestBody.reply_to = replyTo;
  }

  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkError) {
    console.error("[resend_email] Resend send() network error:", networkError);
    throw networkError;
  }

  const responseText = await resendResponse.text();
  let resendData: Record<string, unknown> | null = null;

  try {
    resendData = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : null;
  } catch {
    resendData = { raw: responseText };
  }

  if (!resendResponse.ok) {
    console.error("[resend_email] Resend send() failed:", {
      nodeId: meta?.nodeId ?? null,
      intendedRecipient: meta?.intendedRecipient ?? to,
      status: resendResponse.status,
      statusText: resendResponse.statusText,
      error: resendData,
      request: {
        to: requestBody.to,
        subject: requestBody.subject,
        textLength: signedBody.length,
      },
    });
    const message =
      typeof resendData?.message === "string"
        ? resendData.message
        : typeof resendData?.error === "string"
          ? resendData.error
          : `resend_email: HTTP ${resendResponse.status}`;
    throw new Error(message);
  }

  const messageId =
    typeof resendData?.id === "string"
      ? resendData.id
      : typeof resendData?.id === "number"
        ? String(resendData.id)
        : null;

  if (!messageId) {
    console.error("[resend_email] Resend send() missing message id:", {
      nodeId: meta?.nodeId ?? null,
      response: resendData,
    });
    throw new Error("resend_email: Missing message id in response");
  }

  return { messageId, to, subject, format: "text" };
}

async function insertStepLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: {
    executionId: string;
    clientId: string;
    agentId?: string | null;
    eventType: "STEP_START" | "STEP_COMPLETE" | "OUTBOUND_PIPELINE";
    nodeId?: string;
    nodeType?: string;
    result?: unknown;
    payload?: Record<string, unknown>;
  },
) {
  try {
    const payload: Record<string, unknown> = input.payload ?? {
      nodeId: input.nodeId,
      nodeType: input.nodeType,
    };

    if (input.result !== undefined && !input.payload) {
      payload.result = input.result;
    }

    await supabaseAdmin.from("agent_logs").insert({
      execution_id: input.executionId,
      client_id: input.clientId,
      agent_id: input.agentId ?? null,
      event_type: input.eventType,
      payload,
    });
  } catch (error) {
    console.warn("[run-outbound] failed to insert step log:", error);
  }
}

async function fetchWorkspaceCeoAgentId(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("client_id", clientId)
    .eq("role", "CEO")
    .eq("is_active", true)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

async function notifyCeoOutboundPipeline(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  executionId: string,
  ceoAgentId: string | null,
  input: {
    pipelineSource: string;
    testEmail?: string;
    haltedAtApprovalGate: boolean;
    context: ExecutionContext;
    executionLog: Array<{ nodeId: string; type: string; status: string }>;
    error?: string;
  },
) {
  const apolloLead = Object.values(input.context).find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as Record<string, unknown>).company === "string",
  ) as Record<string, unknown> | undefined;

  const researchEntry = Object.values(input.context).find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      ("brief" in (entry as Record<string, unknown>) || "skipped" in (entry as Record<string, unknown>)),
  ) as Record<string, unknown> | undefined;

  const company = typeof apolloLead?.company === "string" ? apolloLead.company : null;
  const website =
    typeof apolloLead?.website === "string"
      ? apolloLead.website
      : typeof researchEntry?.url === "string"
        ? researchEntry.url
        : null;
  const researchSkipped = researchEntry?.skipped === true;
  const briefSnippet =
    typeof researchEntry?.brief === "string" ? researchEntry.brief.slice(0, 240) : "";

  const summary = {
    pipelineSource: input.pipelineSource,
    leadEmail: input.testEmail ?? null,
    company,
    website,
    researchSkipped,
    researchBriefSnippet: briefSnippet || null,
    haltedAtApprovalGate: input.haltedAtApprovalGate,
    steps: input.executionLog.map((step) => `${step.type}:${step.status}`),
    error: input.error ?? null,
  };

  await insertStepLog(supabaseAdmin, {
    executionId,
    clientId,
    agentId: ceoAgentId,
    eventType: "OUTBOUND_PIPELINE",
    payload: summary,
  });

  if (!ceoAgentId) return;

  const taskSummary = input.error
    ? `Outbound pipeline failed (${input.pipelineSource})`
    : `Outbound draft queued (${input.pipelineSource})${company ? ` — ${company}` : ""}`;

  const strategy = input.error
    ? input.error.slice(0, 500)
    : [
        input.haltedAtApprovalGate ? "Halted at Human Review Queue." : "Completed.",
        researchSkipped ? "Research skipped (no URL or scrape failed)." : "Research completed.",
        briefSnippet ? `Brief: ${briefSnippet}` : "",
        "CEO oversight: review pending drafts in Outbound queue.",
      ]
        .filter(Boolean)
        .join(" ");

  try {
    await supabaseAdmin.from("agent_memory").insert({
      workspace_id: clientId,
      task_summary: taskSummary,
      outcome: input.error ? "FAILURE" : "SUCCESS",
      learned_strategy: strategy.slice(0, 1000),
    });
  } catch (memoryError) {
    console.warn("[run-outbound] failed to write CEO operational memory:", memoryError);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const clientId = body.clientId as string | undefined;
    const sendApproved =
      body.sendApproved === true ||
      body.mode === "send_approved" ||
      body.mode === "send";
    const testEmail = (body.testEmail ?? body.email) as string | undefined;
    let nodes = body.nodes as FlowNode[] | undefined;
    let edges = body.edges as FlowEdge[] | undefined;
    const operatorFeedback =
      typeof body.operatorFeedback === "string" ? body.operatorFeedback.trim() : "";
    const priorDraftSubject =
      typeof body.priorDraftSubject === "string" ? body.priorDraftSubject.trim() : "";
    const priorDraftBody =
      typeof body.priorDraftBody === "string" ? body.priorDraftBody.trim() : "";

    if (!clientId) throw new Error("Missing clientId in request body");
    if (!sendApproved && !testEmail) {
      throw new Error("Missing testEmail or email in request body (safemode destination)");
    }

    if (
      !sendApproved &&
      (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length === 0)
    ) {
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
    console.log("DAG nodes:", nodes?.length ?? 0, "edges:", edges?.length ?? 0);

    const { keys, sources } = await resolveVaultKeys(supabaseAdmin, clientId);

    console.log("Resolved vault keys for client:", clientId, sources);

    if (sendApproved) {
      if (!keys.resend_api_key) {
        throw new Error(formatMissingVaultKeyError("resend_api_key"));
      }

      const leadId = body.leadId as string | undefined;
      const recipientEmail = (
        (body.email as string | undefined) ??
        (body.testEmail as string | undefined)
      )?.trim();
      const textBody = (body.body as string | undefined)?.trim();
      const originalSubject = (
        (body.subject as string | undefined) ?? "Quick question"
      ).trim();

      if (!recipientEmail) {
        throw new Error("send_approved: Missing email or testEmail for intended recipient");
      }
      if (!textBody) {
        throw new Error("send_approved: Missing body (approved copy)");
      }

      let mergeFields: LeadMergeFields;

      if (leadId) {
        const { data: leadRow, error: leadFetchError } = await supabaseAdmin
          .from("leads")
          .select(
            "queue_status, prospect_name, target_company, target_role, email, form_data",
          )
          .eq("id", leadId)
          .eq("client_id", clientId)
          .maybeSingle();

        if (leadFetchError) {
          throw new Error(`send_approved: Failed to load lead: ${leadFetchError.message}`);
        }
        if (!leadRow) {
          throw new Error("send_approved: Lead not found");
        }
        if (leadRow.queue_status !== "approved") {
          throw new Error(
            `send_approved: Lead not approved (status: ${leadRow.queue_status ?? "unknown"})`,
          );
        }

        mergeFields = mergeLeadMergeFields(
          leadRowToMergeFields(leadRow as Record<string, unknown>),
          { email: recipientEmail },
        );
      } else {
        mergeFields = await resolveLeadMergeFieldsForSend(
          supabaseAdmin,
          clientId,
          recipientEmail,
        );
      }

      const sendTarget = resolveOutboundSendTarget(recipientEmail);
      const subject = `${sendTarget.subjectPrefix}${originalSubject}`;
      const fromEmail = (await loadOutboundFromEmail(supabaseAdmin, clientId)) ??
        "Damilare Adeosun <damilare@haltonworks.com>";

      const resendResult = await runResend(
        keys,
        fromEmail,
        sendTarget.to,
        subject,
        textBody,
        { mergeFields },
      );
      const personalizedEmail = personalizeOutboundEmailContent(
        originalSubject,
        textBody,
        mergeFields,
      );

      if (leadId) {
        const { data: leadRowForArchive, error: leadArchiveFetchError } = await supabaseAdmin
          .from("leads")
          .select("form_data")
          .eq("id", leadId)
          .eq("client_id", clientId)
          .maybeSingle();

        if (leadArchiveFetchError) {
          throw new Error(
            `send_approved: Failed to load lead archive fields: ${leadArchiveFetchError.message}`,
          );
        }

        const archivedFormData =
          leadRowForArchive?.form_data &&
          typeof leadRowForArchive.form_data === "object" &&
          !Array.isArray(leadRowForArchive.form_data)
            ? (leadRowForArchive.form_data as Record<string, unknown>)
            : {};

        const { error: leadUpdateError } = await supabaseAdmin
          .from("leads")
          .update({
            status: "contacted",
            queue_status: "sent",
            campaign_status: "SENT",
            generated_copy: appendOutboundFounderSignature(personalizedEmail.body),
            sent_at: new Date().toISOString(),
            form_data: {
              ...archivedFormData,
              draft_subject: personalizedEmail.subject,
            },
          })
          .eq("id", leadId)
          .eq("client_id", clientId);

        if (leadUpdateError) {
          throw new Error(`send_approved: Failed to update lead: ${leadUpdateError.message}`);
        }
      }

      console.info(
        "[run-outbound] send_approved complete",
        { leadId, intendedRecipient: recipientEmail, messageId: resendResult.messageId },
      );

      return new Response(
        JSON.stringify({
          success: true,
          mode: "send_approved",
          resend: {
            ...resendResult,
            sandbox: true,
            intendedRecipient: recipientEmail,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!keys.deepseek_api_key) {
      throw new Error(formatMissingVaultKeyError("deepseek_api_key"));
    }

    if (!keys.resend_api_key) {
      console.warn(
        "[run-outbound] resend_api_key missing; generation still runs but cannot send until approve.",
      );
    }

    const useLiveApollo = Boolean(keys.apollo_api_key?.trim());

    const executionId = crypto.randomUUID();
    const pipelineSource =
      typeof body.pipelineSource === "string" && body.pipelineSource.trim()
        ? body.pipelineSource.trim()
        : sendApproved
          ? "send_approved"
          : "workflow_run";
    const ceoAgentId = await fetchWorkspaceCeoAgentId(supabaseAdmin, clientId);
    const context: ExecutionContext = {};
    const executiveOverrideRaw = body.executiveOverride as Record<string, unknown> | undefined;
    const executiveOverride =
      executiveOverrideRaw &&
      typeof executiveOverrideRaw.node_id === "string" &&
      typeof executiveOverrideRaw.corrected_payload === "string" &&
      typeof executiveOverrideRaw.reason === "string"
        ? {
            node_id: executiveOverrideRaw.node_id.trim(),
            corrected_payload: String(executiveOverrideRaw.corrected_payload),
            reason: String(executiveOverrideRaw.reason),
          }
        : null;
    const priorContextRaw = body.priorContext;
    const priorContext =
      priorContextRaw &&
      typeof priorContextRaw === "object" &&
      !Array.isArray(priorContextRaw)
        ? (priorContextRaw as Record<string, unknown>)
        : null;

    if (executiveOverride) {
      console.info("[run-outbound] Executive override requested", {
        node_id: executiveOverride.node_id,
        reason: executiveOverride.reason,
      });
    }

    const sortedNodes = sortNodesByEdges(nodes, edges);
    const sortedNodeIds = sortedNodes.map((node) => node.id);
    const executionLog: Array<{ nodeId: string; type: string; status: string }> = [];
    let deliverabilityChiefRuntime: AgentRuntimeConfig | null = null;
    let haltedAtApprovalGate = false;

    console.info(
      "[run-outbound] Execution order:",
      sortedNodes.map((n) => `${n.id}:${n.type}`).join(" -> "),
    );

    for (const node of sortedNodes) {
      const nodeType = node.type === "tool" ? getNodeDataString(node, "executor", node.type) : node.type;

      if (haltedAtApprovalGate) {
        console.info(`[${node.id}] Skipping ${nodeType} — pipeline halted (approval required)`);
        executionLog.push({ nodeId: node.id, type: nodeType, status: "skipped_halted" });
        continue;
      }

      if (nodeType === "resend_email" && !testEmail?.trim()) {
        console.info(
          `[${node.id}] resend_email skipped — use sendApproved payload to send after human review`,
        );
        executionLog.push({ nodeId: node.id, type: nodeType, status: "skipped_requires_approval" });
        continue;
      }

      await insertStepLog(supabaseAdmin, {
        executionId,
        clientId,
        agentId: ceoAgentId,
        eventType: "STEP_START",
        nodeId: node.id,
        nodeType,
      });

      try {
        let stepResult: unknown = null;
        let handledStep = false;

        if (
          priorContext &&
          executiveOverride &&
          shouldReusePriorContext(
            node.id,
            executiveOverride.node_id,
            sortedNodeIds,
            priorContext,
          )
        ) {
          stepResult = priorContext[node.id];
          context[node.id] = stepResult;
          executionLog.push({
            nodeId: node.id,
            type: nodeType,
            status: "skipped_prior_context",
          });
          console.info(`[${node.id}] Reusing prior context — executive override resume`);
          handledStep = true;
        } else if (executiveOverride && node.id === executiveOverride.node_id) {
          stepResult = buildExecutiveOverrideNodeOutput(
            nodeType,
            executiveOverride.corrected_payload,
          );
          context[node.id] = stepResult;
          executionLog.push({
            nodeId: node.id,
            type: nodeType,
            status: "executive_override",
          });
          console.info(
            `[${node.id}] EXECUTIVE OVERRIDE — sub-agent halted; CEO payload accepted`,
            { reason: executiveOverride.reason },
          );
          handledStep = true;
        }

        if (!handledStep) {
        switch (nodeType) {
          case "trigger": {
            const leadEmail =
              getNodeDataString(node, "email") ||
              getNodeDataString(node, "testEmail") ||
              testEmail;
            const bulkInjected = node.data?.bulkInjected === true;

            const payload: Record<string, unknown> = {
              testEmail: leadEmail,
              email: leadEmail,
              triggeredAt: new Date().toISOString(),
            };

            const crmFirstName = getNodeDataString(node, "first_name");
            const crmLastName = getNodeDataString(node, "last_name");
            const crmCompany =
              getNodeDataString(node, "company") ||
              getNodeDataString(node, "company_name") ||
              getNodeDataString(node, "target_company");
            const crmTitle =
              getNodeDataString(node, "title") || getNodeDataString(node, "target_role");
            const crmProspectName = getNodeDataString(node, "prospect_name");

            if (crmFirstName) payload.first_name = crmFirstName;
            if (crmLastName) payload.last_name = crmLastName;
            if (crmCompany) {
              payload.company = crmCompany;
              payload.target_company = crmCompany;
            }
            if (crmTitle) payload.title = crmTitle;
            if (crmProspectName) payload.prospect_name = crmProspectName;

            if (bulkInjected) {
              payload.first_name = getNodeDataString(node, "first_name") || "there";
              payload.last_name = getNodeDataString(node, "last_name");
              payload.company = getNodeDataString(node, "company") || "their company";
              payload.target_company = payload.company;
              payload.title = getNodeDataString(node, "title") || "Leader";
              payload.bulkInjected = true;

              const website = getNodeDataString(node, "website");
              const researchUrl = getNodeDataString(node, "research_url");
              const linkedinUrl = getNodeDataString(node, "linkedin_url");
              if (website) payload.website = website;
              if (researchUrl) payload.research_url = researchUrl;
              if (linkedinUrl) payload.linkedin_url = linkedinUrl;
            }

            context[node.id] = payload;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] trigger`, payload);
            stepResult = payload;
            break;
          }

          case "apollo_search": {
            const triggerNode = sortedNodes.find((candidate) => candidate.type === "trigger");
            const triggerCtx = triggerNode ? context[triggerNode.id] : null;
            const isBulkInjected =
              triggerCtx &&
              typeof triggerCtx === "object" &&
              (triggerCtx as Record<string, unknown>).bulkInjected === true;

            if (isBulkInjected && triggerCtx && typeof triggerCtx === "object") {
              const triggerLead = triggerCtx as Record<string, unknown>;
              const triggerNodeData =
                triggerNode?.data && typeof triggerNode.data === "object"
                  ? (triggerNode.data as Record<string, unknown>)
                  : {};

              const website =
                (typeof triggerLead.website === "string" ? triggerLead.website : "") ||
                (typeof triggerNodeData.website === "string" ? triggerNodeData.website : "");
              const researchUrl =
                (typeof triggerLead.research_url === "string" ? triggerLead.research_url : "") ||
                (typeof triggerNodeData.research_url === "string"
                  ? triggerNodeData.research_url
                  : "");
              const linkedinUrl =
                (typeof triggerLead.linkedin_url === "string" ? triggerLead.linkedin_url : "") ||
                (typeof triggerNodeData.linkedin_url === "string"
                  ? triggerNodeData.linkedin_url
                  : "");

              const bulkLead: EnrichedTarget = {
                apollo_person_id: "bulk-csv-inject",
                email:
                  typeof triggerLead.email === "string" ? triggerLead.email : testEmail,
                first_name:
                  typeof triggerLead.first_name === "string"
                    ? triggerLead.first_name
                    : "there",
                last_name:
                  typeof triggerLead.last_name === "string" ? triggerLead.last_name : "",
                title: typeof triggerLead.title === "string" ? triggerLead.title : "Leader",
                company:
                  typeof triggerLead.company === "string"
                    ? triggerLead.company
                    : "their company",
                ...(website.trim() ? { website: website.trim() } : {}),
                ...(researchUrl.trim() ? { research_url: researchUrl.trim() } : {}),
                ...(linkedinUrl.trim() ? { linkedin_url: linkedinUrl.trim() } : {}),
              };
              context[node.id] = bulkLead;
              executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
              console.info(`[${node.id}] apollo_search bulk CSV lead`, bulkLead);
              stepResult = bulkLead;
              break;
            }

            const lead = await runApolloSearch(keys, testEmail, useLiveApollo, node);
            const safemodeLead = { ...lead, email: testEmail };
            context[node.id] = safemodeLead;
            executionLog.push({
              nodeId: node.id,
              type: nodeType,
              status: "ok",
            });
            console.info(`[${node.id}] apollo_search`, safemodeLead);
            stepResult = safemodeLead;
            break;
          }

          case "agent_research": {
            const researchResult = await runAgentResearch(
              keys,
              supabaseAdmin,
              clientId,
              node,
              context,
              sortedNodes,
            );
            context[node.id] = researchResult;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] agent_research`, {
              url: researchResult.url,
              skipped: researchResult.skipped,
              briefLength: typeof researchResult.brief === "string" ? researchResult.brief.length : 0,
            });
            stepResult = researchResult;
            break;
          }

          case "deepseek_llm": {
            const rawPrompt =
              getNodeDataString(node, "prompt") ||
              DEFAULT_DEEPSEEK_PROMPT.replace(/APOLLO_NODE/g, sortedNodes.find((n) =>
                n.type === "apollo_search"
              )?.id ?? "apollo-1");

            let prompt = interpolate(rawPrompt, context);
            if (operatorFeedback) {
              prompt += `\n\n---\nOPERATOR REJECTION (must fix in this new draft):\n${operatorFeedback}`;
              if (priorDraftBody) {
                prompt +=
                  `\n\nPrevious rejected body (do not repeat — write a fresh version):\n${priorDraftBody.slice(0, 2000)}`;
              }
              if (priorDraftSubject) {
                prompt += `\n\nPrevious rejected subject: ${priorDraftSubject.slice(0, 200)}`;
              }
              prompt +=
                "\n\nWrite a new email body only. Address the operator rejection directly. Keep it under 3 sentences. No sign-off or sender name.";
            }

            const writerResult = await runDeepseekWithAgent(
              keys,
              supabaseAdmin,
              clientId,
              node,
              prompt,
            );
            context[node.id] = {
              copy: writerResult.copy,
              prompt: writerResult.prompt,
              agentId: writerResult.agentId,
            };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] deepseek_llm copy length:`, writerResult.copy.length);
            stepResult = context[node.id];
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

            if (!deliverabilityChiefRuntime) {
              deliverabilityChiefRuntime = await fetchDeliverabilityChiefRuntime(
                supabaseAdmin,
                clientId,
                node,
              );
            }

            console.info(
              `[${node.id}] copy_reviewer agent=${deliverabilityChiefRuntime.role} model=${deliverabilityChiefRuntime.model}`,
            );

            const sanitizedText = await runLlmCompletion(
              keys,
              deliverabilityChiefRuntime,
              draft,
              "copy_reviewer",
            );

            const qaResult = await runQaLeadEvaluation(
              keys,
              supabaseAdmin,
              clientId,
              sanitizedText,
              deliverabilityChiefRuntime,
            );

            context[node.id] = {
              copy: sanitizedText,
              agentId: deliverabilityChiefRuntime.agentId,
              qa: qaResult,
            };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(
              `[${node.id}] copy_reviewer sanitized length:`,
              sanitizedText.length,
              `qa=${qaResult.queueStatus}`,
            );
            stepResult = context[node.id];
            break;
          }

          case "approval_gate": {
            const bodyText = resolveSanitizedEmailBody(node, sortedNodes, context);
            const rawSubject = getNodeDataString(node, "subject", DEFAULT_RESEND_SUBJECT);
            const subject = interpolate(rawSubject, context);
            const queueLead = resolveQueueLeadProfile(context, sortedNodes, testEmail);
            const leadEmail = queueLead.email;
            const targetCompany = await resolveTargetCompanyForQueueInsert(
              supabaseAdmin,
              clientId,
              queueLead,
            );

            const reviewerNode = sortedNodes.find((candidate) => candidate.type === "copy_reviewer");
            const reviewerCtx = reviewerNode ? context[reviewerNode.id] : null;
            let queueStatus: ApprovalQueueStatus = "pending";
            let qaViolations: string[] = [];
            let qaSource = "default";

            if (reviewerCtx && typeof reviewerCtx === "object") {
              const qa = (reviewerCtx as Record<string, unknown>).qa;
              if (qa && typeof qa === "object") {
                const qaRecord = qa as Record<string, unknown>;
                const status = qaRecord.queueStatus;
                if (
                  status === "approved" ||
                  status === "qa_rejected" ||
                  status === "needs_human_review" ||
                  status === "pending"
                ) {
                  queueStatus = status;
                }
                if (Array.isArray(qaRecord.violations)) {
                  qaViolations = qaRecord.violations.filter(
                    (entry): entry is string => typeof entry === "string",
                  );
                }
                if (typeof qaRecord.source === "string") {
                  qaSource = qaRecord.source;
                }
              }
            }

            const { data: existingQueueLead } = await supabaseAdmin
              .from("leads")
              .select("form_data")
              .eq("email", leadEmail)
              .eq("client_id", clientId)
              .maybeSingle();

            const priorFormData =
              existingQueueLead?.form_data &&
              typeof existingQueueLead.form_data === "object" &&
              !Array.isArray(existingQueueLead.form_data)
                ? (existingQueueLead.form_data as Record<string, unknown>)
                : {};

            const rejectionHistory = Array.isArray(priorFormData.draft_rejection_history)
              ? priorFormData.draft_rejection_history.filter(
                (entry): entry is Record<string, unknown> =>
                  typeof entry === "object" && entry !== null,
              )
              : [];

            const nextFormData: Record<string, unknown> = {
              ...priorFormData,
              draft_subject: subject,
            };

            const research = findResearchBriefFromContext(sortedNodes, context);
            const apolloLead = findApolloLeadContext(sortedNodes, context);
            if (research.brief) {
              nextFormData.company_brief = research.brief;
            }
            if (research.url) {
              nextFormData.research_url = research.url;
            }
            if (apolloLead) {
              if (typeof apolloLead.website === "string" && apolloLead.website.trim()) {
                nextFormData.website = apolloLead.website.trim();
              }
              if (typeof apolloLead.linkedin_url === "string" && apolloLead.linkedin_url.trim()) {
                nextFormData.linkedin_url = apolloLead.linkedin_url.trim();
              }
            }

            if (operatorFeedback) {
              nextFormData.draft_rejection_history = [
                ...rejectionHistory,
                {
                  reason: operatorFeedback,
                  rejected_at: new Date().toISOString(),
                  prior_subject: priorDraftSubject || subject,
                  prior_body: priorDraftBody || bodyText,
                },
              ].slice(-10);
            }

            const { error: queueError } = await supabaseAdmin.from("leads").upsert(
              {
                client_id: clientId,
                email: leadEmail,
                prospect_name: queueLead.prospect_name,
                target_company: targetCompany,
                target_role: queueLead.target_role,
                generated_copy: bodyText,
                campaign_status: "PENDING_REVIEW",
                queue_status: queueStatus,
                form_data: nextFormData,
              },
              { onConflict: "email,client_id" },
            );

            if (queueError) {
              throw new Error(
                `approval_gate: Human Review Queue (leads) insert failed: ${queueError.message}`,
              );
            }

            const queuePayload = {
              queued: true,
              email: leadEmail,
              subject,
              body: bodyText,
              queue_status: queueStatus,
              qa_violations: qaViolations,
              qa_source: qaSource,
              source: "copy_reviewer",
            };
            context[node.id] = queuePayload;
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });

            haltedAtApprovalGate = queueStatus !== "approved";

            if (haltedAtApprovalGate) {
              console.info(
                `[${node.id}] approval_gate HALT — queue_status=${queueStatus}; resend_email blocked until approved`,
                queuePayload,
              );
            } else {
              console.info(
                `[${node.id}] approval_gate QA auto-approved — resend_email may proceed`,
                queuePayload,
              );
            }

            stepResult = queuePayload;
            break;
          }

          case "resend_email": {
            if (!keys.resend_api_key) {
              throw new Error(formatMissingVaultKeyError("resend_api_key"));
            }

            const bodyText = resolveSanitizedEmailBody(node, sortedNodes, context);
            const rawSubject = getNodeDataString(node, "subject", DEFAULT_RESEND_SUBJECT);
            const lead = findApolloLead(context, sortedNodes);
            const intendedRecipient =
              interpolate(getNodeDataString(node, "to", testEmail ?? ""), context) ||
              lead?.email?.trim() ||
              testEmail ||
              SANDBOX_TO_EMAIL;

            const approvalCheck = await assertLeadApprovedForSend(
              supabaseAdmin,
              clientId,
              intendedRecipient,
            );

            if (!approvalCheck.approved) {
              const blockedStatus = approvalCheck.queueStatus ?? "missing";
              context[node.id] = {
                blocked: true,
                queue_status: blockedStatus,
                intendedRecipient,
              };
              executionLog.push({
                nodeId: node.id,
                type: nodeType,
                status: "blocked_not_approved",
              });
              console.info(
                `[${node.id}] resend_email blocked — queue_status=${blockedStatus}, requires approved`,
              );
              stepResult = context[node.id];
              haltedAtApprovalGate = true;
              break;
            }

            const mergeFields = await resolveLeadMergeFieldsForSend(
              supabaseAdmin,
              clientId,
              intendedRecipient,
              context,
              sortedNodes,
            );
            const personalizedSubject = personalizeSubjectForSend(
              rawSubject,
              context,
              mergeFields,
            );
            const sendTarget = resolveOutboundSendTarget(intendedRecipient);
            const subject = `${sendTarget.subjectPrefix}${personalizedSubject}`;
            const fromEmail = (await loadOutboundFromEmail(supabaseAdmin, clientId)) ??
              "Damilare Adeosun <damilare@haltonworks.com>";

            const resendResult = await runResend(
              keys,
              fromEmail,
              sendTarget.to,
              subject,
              bodyText,
              { nodeId: node.id, intendedRecipient, mergeFields },
            );

            context[node.id] = {
              ...resendResult,
              sandbox: sendTarget.sandbox,
              intendedRecipient,
            };
            executionLog.push({ nodeId: node.id, type: nodeType, status: "ok" });
            console.info(`[${node.id}] resend_email sent`, context[node.id]);
            stepResult = context[node.id];
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
        }

        await insertStepLog(supabaseAdmin, {
          executionId,
          clientId,
          agentId: ceoAgentId,
          eventType: "STEP_COMPLETE",
          nodeId: node.id,
          nodeType,
          result: stepResult,
        });

        if (haltedAtApprovalGate) {
          console.info("[run-outbound] Engine halted at approval_gate — downstream nodes skipped");
          break;
        }
      } catch (stepError: unknown) {
        const message = stepError instanceof Error ? stepError.message : "Unknown step error";
        context[node.id] = { error: message };
        executionLog.push({ nodeId: node.id, type: nodeType, status: "error" });
        console.error(`[${node.id}] ${nodeType} failed:`, message);

        await insertStepLog(supabaseAdmin, {
          executionId,
          clientId,
          agentId: ceoAgentId,
          eventType: "STEP_COMPLETE",
          nodeId: node.id,
          nodeType,
          result: { error: message },
        });
        await notifyCeoOutboundPipeline(supabaseAdmin, clientId, executionId, ceoAgentId, {
          pipelineSource,
          testEmail,
          haltedAtApprovalGate,
          context,
          executionLog,
          error: message,
        });
        throw stepError;
      }
    }

    await notifyCeoOutboundPipeline(supabaseAdmin, clientId, executionId, ceoAgentId, {
      pipelineSource,
      testEmail,
      haltedAtApprovalGate,
      context,
      executionLog,
    });

    return new Response(
      JSON.stringify({
        success: true,
        haltedAtApprovalGate,
        context,
        executionLog,
        executionId,
        sortedNodeIds: sortedNodes.map((n) => n.id),
        executiveOverride: executiveOverride
          ? {
              node_id: executiveOverride.node_id,
              reason: executiveOverride.reason,
            }
          : null,
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
