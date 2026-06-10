/**
 * Upserts the default research-aware workflow graph for Halton Client #0.
 * Run after deploying run-outbound with agent_research support.
 *
 *   npx tsx scripts/patchHaltonWorkflowResearch.ts
 */
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_WORKFLOW_GRAPH } from "../src/lib/admin/workflowsRepository.ts";

const HALTON_CLIENT_ID = "f302976c-8dd2-42ba-8924-1be65e412172";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const { error } = await supabase.from("workflows").upsert(
  {
    client_id: HALTON_CLIENT_ID,
    name: "Halton Outbound SOP",
    graph_json: DEFAULT_WORKFLOW_GRAPH,
    is_active: true,
  },
  { onConflict: "client_id" },
);

if (error) {
  console.error("Failed to patch workflow:", error.message);
  process.exit(1);
}

console.log("✓ Halton workflow updated with agent_research node (research-1 → llm-1).");
