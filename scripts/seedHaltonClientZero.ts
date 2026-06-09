/**
 * Phase 1 — Bootstrap Halton Works as Client #0.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/seedHaltonClientZero.ts
 */
import { randomBytes } from "node:crypto";
import { companyToSlug } from "../src/lib/admin-workspaces.ts";
import { onboardClient } from "../src/lib/admin/onboardClient.ts";
import { saveToKnowledgeVault } from "../src/lib/admin/clientKnowledge.server.ts";
import { DEFAULT_WORKFLOW_GRAPH } from "../src/lib/admin/workflowsRepository.ts";
import { createSupabaseServer } from "../src/lib/supabase-server.ts";

const COMPANY_NAME = "Halton Works";
const PRIMARY_EMAIL = "damilare@haltonworks.com";
const SENDING_DOMAIN = "haltonworks.com";
const CAL_DISCOVERY_URL = "https://cal.com/adeosun-damilare-q6qkrm/discovery";
const SUPABASE_PROJECT_REF = "kjpotitnwaqloudpxpro";

const TARGET_ICP =
  "B2B SaaS founders and CEOs at Seed–Series A companies. £20k+ ACV. UK + US. Outbound is a bottleneck OR primary domain deliverability is at risk. Has product-market fit signals and budget to deploy.";

const CORE_OFFER =
  "Permanent outbound infrastructure: protected sending domains, intent-based prospecting, 24/7 automated sequences, and inbox triage. We deliver booked discovery calls — not vanity metrics. £3,000 setup + £1,500/mo. 3 partners per quarter.";

const VAULT_ENTRIES: Array<{
  category: "core_offer" | "brand_voice" | "objection_handling" | "general" | "case_study";
  title: string;
  content: string;
}> = [
  {
    category: "core_offer",
    title: "Halton Works — Core Offer",
    content: `Halton/Works is a private growth engineering practice. We architect silent, automated systems behind compounding revenue for high-ticket B2B SaaS companies.

Four layers:
1. Risk Reversal — secondary domains + strict DNS; protect the primary domain from blacklists.
2. Intent Data Orchestration — target prospects with capital and timing signals.
3. Automated Execution — 24/7 sequence engine; no junior SDR salaries.
4. Inbox Triage — filter noise; notify only on high-intent replies and booked meetings.

Pricing: £3,000 one-time setup + £1,500/month retainer. Maximum 3 new partners per quarter.`,
  },
  {
    category: "brand_voice",
    title: "Brand Voice",
    content: `Direct, infrastructure language. No "synergy", "revolutionize", or "hope this finds you well". Never sell open rates or clicks — sell booked sales calls. Founder-led tone (Damilare Adeosun). Position as growth engineering, not a marketing agency.`,
  },
  {
    category: "objection_handling",
    title: "Common Objections",
    content: `"We tried outbound" → Junior SDR math is broken: salary + tools + churn vs rules-based infrastructure.
"We use an agency" → Agencies sell activity; we book meetings with buyers who show up.
"Too expensive" → £1,500/mo vs one SDR hire + stack; we deliver booked calls, not reports.
"Will you spam our domain?" → Secondary domain architecture protects primary inbox.`,
  },
  {
    category: "general",
    title: "ICP Filters",
    content: `Titles: Founder, CEO, Co-Founder.
Industries: B2B SaaS, computer software.
Company size: 5–100 employees.
Geo: United Kingdom, United States.
Disqualify: agencies, consultancies, consumer apps, sub-£10k ACV, no budget.`,
  },
  {
    category: "general",
    title: "CTAs",
    content: `Primary discovery booking: ${CAL_DISCOVERY_URL}
Secondary apply form (marketing site only): https://tally.so/r/QKO5j1
Do not put Tally in cold email #1. Use soft ask for 15-min call; send Cal.com link on positive reply.`,
  },
  {
    category: "case_study",
    title: "Client #0 — Halton Dogfood",
    content: `Halton Works is its own first workspace (Client #0). We run outbound on this stack to acquire paying SaaS clients before onboarding Client #1. Document wins, reply rates, and booked calls here as proof.`,
  },
];

function resolveTempPassword(): string {
  const fromEnv = process.env.HALTON_CLIENT_TEMP_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  return `Hw-${randomBytes(12).toString("base64url")}`;
}

async function main() {
  const admin = createSupabaseServer();
  const slug = companyToSlug(COMPANY_NAME);

  const { data: existing } = await admin
    .from("clients")
    .select("id, company_name, slug")
    .eq("slug", slug)
    .maybeSingle();

  let clientId: string;

  if (existing?.id) {
    clientId = existing.id;
    console.log(`[seed] Workspace already exists: ${existing.company_name} (${clientId})`);
  } else {
    const tempPassword = resolveTempPassword();
    const result = await onboardClient({
      companyName: COMPANY_NAME,
      primaryContactEmail: PRIMARY_EMAIL,
      temporaryPassword: tempPassword,
      targetIcp: TARGET_ICP,
      coreOffer: CORE_OFFER,
      sendingDomain: SENDING_DOMAIN,
    });

    if (!result.ok) {
      throw new Error(`Onboard failed: ${result.error}`);
    }

    clientId = result.clientId;
    console.log(`[seed] Created workspace ${clientId}`);
    if (!process.env.HALTON_CLIENT_TEMP_PASSWORD?.trim()) {
      console.log(`[seed] Client auth password (save securely): ${tempPassword}`);
      console.log(`[seed] Login at /login with ${PRIMARY_EMAIL}`);
    }
  }

  const credentialPatch: Record<string, string> = {};
  const deepseek =
    process.env.HALTON_DEEPSEEK_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim();
  const slack =
    process.env.HALTON_SLACK_WEBHOOK_URL?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim();
  const calCom = process.env.HALTON_CAL_COM_API_KEY?.trim() || process.env.CAL_COM_API_KEY?.trim();
  const notionKey = process.env.HALTON_NOTION_API_KEY?.trim() || process.env.NOTION_API_KEY?.trim();
  const notionDb =
    process.env.HALTON_NOTION_DATABASE_ID?.trim() || process.env.NOTION_DATABASE_ID?.trim();

  if (deepseek) credentialPatch.deepseek_api_key = deepseek;
  if (slack) credentialPatch.slack_webhook_url = slack;
  if (calCom) credentialPatch.cal_com_api_key = calCom;
  if (notionKey) credentialPatch.notion_api_key = notionKey;
  if (notionDb) credentialPatch.notion_database_id = notionDb;

  const { error: clientUpdateError } = await admin
    .from("clients")
    .update({
      company_name: COMPANY_NAME,
      primary_contact_email: PRIMARY_EMAIL,
      sending_domain: SENDING_DOMAIN,
      target_icp: TARGET_ICP,
      core_offer: CORE_OFFER,
      monthly_retainer: 1500,
      infrastructure_status: "Nominal",
      ...credentialPatch,
    })
    .eq("id", clientId);

  if (clientUpdateError) {
    throw new Error(`Client update failed: ${clientUpdateError.message}`);
  }

  console.log("[seed] Updated client profile + credentials (from env where set)");

  for (const entry of VAULT_ENTRIES) {
    const { data: dup } = await admin
      .from("client_knowledge")
      .select("id")
      .eq("client_id", clientId)
      .eq("title", entry.title)
      .maybeSingle();

    if (dup?.id) {
      const { error } = await admin
        .from("client_knowledge")
        .update({ content: entry.content, category: entry.category })
        .eq("id", dup.id);
      if (error) console.warn(`[seed] vault update failed (${entry.title}):`, error.message);
      else console.log(`[seed] vault updated: ${entry.title}`);
      continue;
    }

    const saved = await saveToKnowledgeVault({
      clientId,
      title: entry.title,
      content: entry.content,
      category: entry.category,
    });

    if ("error" in saved) {
      console.warn(`[seed] vault insert failed (${entry.title}):`, saved.error);
    } else {
      console.log(`[seed] vault created: ${entry.title}`);
    }
  }

  const { data: workflowRow } = await admin
    .from("workflows")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (workflowRow?.id) {
    const { error } = await admin
      .from("workflows")
      .update({ graph_json: DEFAULT_WORKFLOW_GRAPH, is_active: true })
      .eq("id", workflowRow.id);
    if (error) console.warn("[seed] workflow update failed:", error.message);
    else console.log("[seed] workflow updated to Halton SaaS default");
  } else {
    const { error } = await admin.from("workflows").insert({
      client_id: clientId,
      graph_json: DEFAULT_WORKFLOW_GRAPH,
      is_active: true,
    });
    if (error) console.warn("[seed] workflow insert failed:", error.message);
    else console.log("[seed] workflow created (Halton SaaS default)");
  }

  const bookingWebhook = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/catch-booking?clientId=${clientId}`;

  console.log("\n--- Phase 1 complete ---");
  console.log(`Admin workspace: /admin/client/${clientId}`);
  console.log(`Cal.com webhook URL (replace old clientId in Cal.com):\n  ${bookingWebhook}`);
  console.log(`Resend inbound webhook (keep existing in Resend dashboard):\n  https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/inbound-webhook`);
  console.log(`Optional Vercel inbound (only if you switch Resend away from Supabase):\n  https://haltonworks.com/api/inbound/resend`);
  console.log("\nCredentials status:");
  console.log(`  DeepSeek: ${deepseek ? "set from env" : "MISSING — add in Infrastructure vault"}`);
  console.log(`  Slack: ${slack ? "set from env" : "MISSING — paste webhook in Infrastructure vault"}`);
  console.log(`  Cal.com API: ${calCom ? "set from env" : "optional — webhook may work without API key"}`);
  console.log(`  Notion: ${notionKey && notionDb ? "set from env" : "optional — skip for now"}`);
  console.log(`  Apollo: MISSING — required for live lead pull`);
  console.log(`  Resend: uses platform RESEND_API_KEY + domain ${SENDING_DOMAIN}`);
  console.log(`  Firecrawl: MISSING — optional for enrichment`);
}

main().catch((error) => {
  console.error("[seed] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
