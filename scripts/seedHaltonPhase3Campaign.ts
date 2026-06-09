/**
 * Phase 3 — Halton Client #0 campaign sequences + email templates.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/seedHaltonPhase3Campaign.ts
 */
import { upsertCampaignSequencesServer } from "../src/lib/admin/campaignSequencesRepository.ts";
import { createSupabaseServer } from "../src/lib/supabase-server.ts";

const HALTON_CLIENT_ID = "f302976c-8dd2-42ba-8924-1be65e412172";
const CAL_DISCOVERY_URL = "https://cal.com/adeosun-damilare-q6qkrm/discovery";

const SEQUENCE_STEPS = [
  {
    step_number: 1,
    delay_days: 0,
    subject: "{{first_name}} — outbound at {{company_name}}",
    body: `Hi {{first_name}},

Most Seed–Series A SaaS teams I speak with hit the same wall at {{company_name}}: outbound should be compounding, but pipeline still depends on manual prospecting or a junior SDR hire that churns.

The other risk is volume from your primary domain until deliverability starts slipping.

Worth a 15-minute call to see if permanent outbound infrastructure would be a fit for {{company_name}}? No pitch deck — just whether the math works.`,
  },
  {
    step_number: 2,
    delay_days: 3,
    subject: "Infrastructure vs another SDR hire — {{company_name}}",
    body: `Hi {{first_name}},

Following up — I'm Damilare, founder of Halton Works. We build outbound infrastructure for high-ticket B2B SaaS: protected sending domains, automated sequences, and inbox triage until a qualified meeting is booked.

Not an agency retainer for activity metrics — we book calls.

If {{company_name}} is still evaluating outbound options, happy to walk through how we replaced the broken SDR math for similar founders. 15 minutes?`,
  },
  {
    step_number: 3,
    delay_days: 7,
    subject: "Should I close the loop, {{first_name}}?",
    body: `Hi {{first_name}},

Last note from me — we take on three new partners per quarter and I don't want to clutter your inbox.

If outbound infrastructure for {{company_name}} isn't a priority right now, ignore this. If it is, grab a slot here: ${CAL_DISCOVERY_URL}

Either way — wishing {{company_name}} a strong quarter.`,
  },
] as const;

const EMAIL_TEMPLATES = [
  {
    name: "Step 1 — Pipeline + deliverability hook",
    subject: "{{first_name}} — outbound at {{company_name}}",
    body: SEQUENCE_STEPS[0].body,
  },
  {
    name: "Step 2 — Halton Works intro",
    subject: "Infrastructure vs another SDR hire — {{company_name}}",
    body: SEQUENCE_STEPS[1].body,
  },
  {
    name: "Step 3 — Breakup + Cal.com",
    subject: "Should I close the loop, {{first_name}}?",
    body: SEQUENCE_STEPS[2].body,
  },
] as const;

async function upsertTemplateByName(
  clientId: string,
  template: (typeof EMAIL_TEMPLATES)[number],
): Promise<void> {
  const admin = createSupabaseServer();
  const { data: existing } = await admin
    .from("email_templates")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", template.name)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing?.id) {
    const { error } = await admin
      .from("email_templates")
      .update({
        subject: template.subject,
        body: template.body,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Template update failed (${template.name}): ${error.message}`);
    console.log(`[phase3] template updated: ${template.name}`);
    return;
  }

  const { error } = await admin.from("email_templates").insert({
    client_id: clientId,
    name: template.name,
    subject: template.subject,
    body: template.body,
    updated_at: now,
  });
  if (error) throw new Error(`Template insert failed (${template.name}): ${error.message}`);
  console.log(`[phase3] template created: ${template.name}`);
}

async function main() {
  const clientId = process.env.HALTON_CLIENT_ID?.trim() || HALTON_CLIENT_ID;

  const sequenceResult = await upsertCampaignSequencesServer(clientId, [...SEQUENCE_STEPS]);
  if ("error" in sequenceResult) {
    throw new Error(sequenceResult.error);
  }
  console.log(`[phase3] campaign_sequences upserted (${sequenceResult.steps.length} steps)`);

  for (const template of EMAIL_TEMPLATES) {
    await upsertTemplateByName(clientId, template);
  }

  console.log("\n--- Phase 3 campaign seed complete ---");
  console.log(`Sequence editor: /admin/client/${clientId}/sequence`);
  console.log(`Copy library:    /admin/client/${clientId}/templates`);
  console.log(`Campaign rules:  /admin/client/${clientId}/workflow`);
  console.log(`Bulk CSV import: /admin/client/${clientId}/outbound`);
  console.log("\nNext: review copy in UI, keep sequence PAUSED until first batch approved.");
}

main().catch((error) => {
  console.error("[phase3] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
