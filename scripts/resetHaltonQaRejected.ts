/**
 * One-off: reset false-positive qa_rejected leads (signature counted as a 4th sentence)
 * back to pending for the Halton Client #0 workspace.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/resetHaltonQaRejected.ts
 */
import { createSupabaseServer } from "../src/lib/supabase-server.ts";

const HALTON_CLIENT_ID = "f302976c-8dd2-42ba-8924-1be65e412172";

async function main() {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("leads")
    .update({ queue_status: "pending" })
    .eq("client_id", HALTON_CLIENT_ID)
    .eq("queue_status", "qa_rejected")
    .select("id, email");

  if (error) throw new Error(error.message);

  console.log(`Reset ${data?.length ?? 0} leads from qa_rejected → pending:`);
  for (const lead of data ?? []) {
    console.log(`  - ${lead.email}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
