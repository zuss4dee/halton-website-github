import { createSupabaseServer } from "../src/lib/supabase-server.ts";

const clientId = process.argv[2]?.trim() || "f302976c-8dd2-42ba-8924-1be65e412172";

async function main() {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("leads")
    .select("status, queue_status")
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);

  const byStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = (row.status as string | null) ?? "(null)";
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }

  const { count: repliedStatus } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "replied");

  const { count: repliesTable } = await supabase
    .from("replies")
    .select("lead_id, leads!inner(client_id)", { count: "exact", head: true })
    .eq("leads.client_id", clientId);

  console.log("clientId:", clientId);
  console.log("total leads:", data?.length ?? 0);
  console.log("by status:", byStatus);
  console.log("count status=replied:", repliedStatus);
  console.log("count replies table:", repliesTable);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
