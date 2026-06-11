/**
 * Reset leads marked status=replied (or qualified) with no inbound reply evidence.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/fixFalseRepliedLeadStatus.ts [clientId]
 */
import { createSupabaseServer } from "../src/lib/supabase-server.ts";
import { readInboundReplyFromLead } from "../src/lib/admin/inboundReply.ts";

const DEFAULT_CLIENT_ID = "f302976c-8dd2-42ba-8924-1be65e412172";

const FALSE_REPLY_STATUSES = new Set(["replied", "qualified", "positive_reply"]);

async function main() {
  const clientId = process.argv[2]?.trim() || DEFAULT_CLIENT_ID;
  const supabase = createSupabaseServer();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email, status, sent_at, queue_status, form_data")
    .eq("client_id", clientId)
    .or(
      "status.in.(replied,qualified,positive_reply),and(sent_at.not.is.null,status.eq.pending)",
    );

  if (error) throw new Error(error.message);

  const leadIds = (leads ?? []).map((lead) => lead.id as string).filter(Boolean);
  const replyLeadIds = new Set<string>();

  if (leadIds.length > 0) {
    const { data: replies, error: repliesError } = await supabase
      .from("replies")
      .select("lead_id")
      .in("lead_id", leadIds);

    if (repliesError) throw new Error(repliesError.message);

    for (const row of replies ?? []) {
      if (row.lead_id) replyLeadIds.add(row.lead_id as string);
    }
  }

  const toFix: Array<{ id: string; email: string | null; nextStatus: string | null }> = [];

  for (const row of leads ?? []) {
    const lead = row as {
      id: string;
      email: string | null;
      status: string | null;
      sent_at: string | null;
      queue_status: string | null;
      form_data: Record<string, unknown> | null;
    };

    if (replyLeadIds.has(lead.id)) continue;
    if (readInboundReplyFromLead(lead)) continue;

    const status = lead.status?.trim().toLowerCase() ?? "";
    const nextStatus = lead.sent_at ? "contacted" : null;

    if (!lead.sent_at && !FALSE_REPLY_STATUSES.has(status)) continue;

    toFix.push({ id: lead.id, email: lead.email, nextStatus });
  }

  if (toFix.length === 0) {
    console.log("No false replied/qualified leads to fix.");
    return;
  }

  console.log(`Fixing ${toFix.length} lead(s):`);

  for (const lead of toFix) {
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: lead.nextStatus })
      .eq("id", lead.id);

    if (updateError) {
      console.error(`  FAILED ${lead.email ?? lead.id}: ${updateError.message}`);
      continue;
    }

    console.log(
      `  ${lead.email ?? lead.id}: status → ${lead.nextStatus ?? "NULL"} (no inbound reply evidence)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
