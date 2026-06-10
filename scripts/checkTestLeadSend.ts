import { createSupabaseServer } from "../src/lib/supabase-server.ts";

async function main() {
  const sb = createSupabaseServer();
  const { data, error } = await sb
    .from("leads")
    .select("id, email, queue_status, campaign_status, sent_at, created_at, client_id")
    .ilike("email", "adedamilare1@gmail.com")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("leads:", JSON.stringify({ error, data }, null, 2));

  const { data: client } = await sb
    .from("clients")
    .select("resend_api_key, sending_domain, primary_contact_email, company_name")
    .eq("id", "f302976c-8dd2-42ba-8924-1be65e412172")
    .maybeSingle();

  console.log(
    "client:",
    JSON.stringify(
      {
        hasResend: Boolean(client?.resend_api_key?.trim()),
        resendPrefix: client?.resend_api_key?.slice(0, 8),
        sending_domain: client?.sending_domain,
        primary: client?.primary_contact_email,
      },
      null,
      2,
    ),
  );

  const { data: logs } = await sb
    .from("agent_logs")
    .select("event_type, payload, created_at")
    .eq("client_id", "f302976c-8dd2-42ba-8924-1be65e412172")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("recent agent_logs:", JSON.stringify(logs, null, 2));
}

main().catch(console.error);
