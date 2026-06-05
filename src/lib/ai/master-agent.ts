import { generateObject } from "ai";
import { z } from "zod";

import { companyToSlug } from "@/lib/admin-workspaces";
import { provisionWorkspaceCeoAgent } from "@/lib/admin/provisionWorkspaceCeo";
import { supabase } from "@/lib/supabase";

import { deepseek } from "./providers";

const commandSchema = z.object({
  intent: z.enum(["CREATE_CLIENT", "PULL_LEADS", "UNKNOWN"]),
  companyName: z.string().optional(),
  monthlyRetainer: z.number().optional(),
  targetIndustry: z.string().optional(),
  targetClientSlug: z.string().optional(),
  leadCount: z.number().optional(),
});

export type MasterCommandIntent = "CREATE_CLIENT" | "PULL_LEADS" | "UNKNOWN";

export type MasterCommandData = {
  clientId?: string;
  slug?: string;
  [key: string]: unknown;
};

export type MasterCommandResult = {
  success: boolean;
  intent: MasterCommandIntent;
  message: string;
  data?: MasterCommandData;
};

type ClientRecord = {
  id: string;
  slug: string | null;
  company_name?: string | null;
};

function slugToCompanyName(slugOrHint: string): string {
  return slugOrHint
    .trim()
    .replace(/\s+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeClientSlug(hint: string): string {
  return companyToSlug(hint) || hint.trim().toLowerCase().replace(/\s+/g, "-");
}

function buildIndustryLeads(clientId: string, industry: string, count: number) {
  const industryLabel = industry.trim() || "B2B";
  const templates = [
    {
      client_id: clientId,
      prospect_name: "Jane Doe",
      target_company: "LogisticsOS",
      target_role: `VP of ${industryLabel} Operations`,
      enrichment_status: "PENDING_SCRAPE",
    },
    {
      client_id: clientId,
      prospect_name: "John Smith",
      target_company: `${industryLabel} FreightFlow`,
      target_role: "Director of Logistics",
      enrichment_status: "PENDING_SCRAPE",
    },
    {
      client_id: clientId,
      prospect_name: "Alice Johnson",
      target_company: "CargoNet",
      target_role: "Head of Procurement",
      enrichment_status: "PENDING_SCRAPE",
    },
    {
      client_id: clientId,
      prospect_name: "Marcus Chen",
      target_company: `${industryLabel} Nexus`,
      target_role: "COO",
      enrichment_status: "PENDING_SCRAPE",
    },
    {
      client_id: clientId,
      prospect_name: "Elena Marsh",
      target_company: "Northline Collective",
      target_role: `Director of ${industryLabel}`,
      enrichment_status: "PENDING_SCRAPE",
    },
  ];

  return templates.slice(0, Math.max(1, count));
}

async function resolveOrCreateClient(targetClientSlug: string): Promise<{
  client: ClientRecord | null;
  autoCreated: boolean;
  errorMessage?: string;
}> {
  const slugPattern = `%${targetClientSlug.replace(/\s+/g, "-")}%`;

  const { data: matches, error: lookupError } = await supabase
    .from("clients")
    .select("id, slug, company_name")
    .ilike("slug", slugPattern)
    .limit(1);

  if (lookupError) {
    console.error("❌ CLIENT LOOKUP ERROR:", lookupError);
  }

  const existing = matches?.[0] as ClientRecord | undefined;
  if (existing?.id) {
    return { client: existing, autoCreated: false };
  }

  console.log("⚠️ CLIENT MISSING, AUTO-CREATING ROW...");

  const slug = normalizeClientSlug(targetClientSlug);
  const companyName = slugToCompanyName(targetClientSlug);

  const { data: created, error: createError } = await supabase
    .from("clients")
    .insert({
      company_name: companyName,
      monthly_retainer: 1500,
      slug,
    })
    .select("id, slug, company_name")
    .single();

  if (createError || !created?.id) {
    console.error("❌ CLIENT AUTO-CREATE ERROR:", createError);
    return {
      client: null,
      autoCreated: true,
      errorMessage: createError?.message ?? "Failed to auto-create client workspace.",
    };
  }

  console.log("✅ CLIENT AUTO-CREATED:", created.id, created.slug);

  return { client: created as ClientRecord, autoCreated: true };
}

export async function executeMasterCommand(prompt: string): Promise<MasterCommandResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { success: false, intent: "UNKNOWN", message: "Command cannot be empty." };
  }

  const { object } = await generateObject({
    model: deepseek("deepseek-chat"),
    schema: commandSchema,
    system:
      "You are the Master Routing Agent for an elite outbound agency. Parse the user's command to extract the intent and any relevant variables. Use CREATE_CLIENT when they want to onboard a new client. Use PULL_LEADS when they want to pull, stage, or generate leads for an existing client workspace (extract targetClientSlug, targetIndustry, and optional leadCount).",
    prompt: trimmed,
  });

  console.log("🤖 AI INTENT PARSED:", object);

  if (object.intent === "UNKNOWN") {
    return {
      success: false,
      intent: "UNKNOWN",
      message: "Could not determine a supported command intent.",
      data: object,
    };
  }

  if (object.intent === "CREATE_CLIENT") {
    const companyName = object.companyName?.trim();
    if (!companyName) {
      return {
        success: false,
        intent: "CREATE_CLIENT",
        message: "CREATE_CLIENT requires a company name.",
        data: object,
      };
    }

    const monthlyRetainer = object.monthlyRetainer ?? 1500;
    const slug = companyToSlug(companyName);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        company_name: companyName,
        monthly_retainer: monthlyRetainer,
        slug,
      })
      .select("id, slug, company_name")
      .single();

    if (error || !data?.id) {
      console.error("❌ CREATE_CLIENT INSERT ERROR:", error);
      return {
        success: false,
        intent: "CREATE_CLIENT",
        message: error?.message ?? "Failed to create client.",
        data: object,
      };
    }

    const ceoProvision = await provisionWorkspaceCeoAgent(data.id);
    if (!ceoProvision.ok) {
      await supabase.from("clients").delete().eq("id", data.id);
      console.error("❌ CREATE_CLIENT CEO PROVISION ERROR:", ceoProvision.error);
      return {
        success: false,
        intent: "CREATE_CLIENT",
        message: ceoProvision.error,
        data: object,
      };
    }

    console.log("✅ CLIENT CREATED:", data.id, data.slug);

    return {
      success: true,
      intent: "CREATE_CLIENT",
      message: "Client created",
      data: {
        clientId: data.id,
        slug: data.slug ?? slug,
      },
    };
  }

  if (object.intent === "PULL_LEADS") {
    const targetClientSlug = object.targetClientSlug?.trim();
    if (!targetClientSlug) {
      return {
        success: false,
        intent: "PULL_LEADS",
        message: "PULL_LEADS requires a target client slug.",
        data: object,
      };
    }

    const { client, autoCreated, errorMessage } = await resolveOrCreateClient(targetClientSlug);

    if (!client?.id) {
      return {
        success: false,
        intent: "PULL_LEADS",
        message: errorMessage ?? "Client not found in database.",
        data: object,
      };
    }

    const targetIndustry = object.targetIndustry?.trim() ?? "General";
    const leadCount = object.leadCount ?? 3;
    const dummyLeads = buildIndustryLeads(client.id, targetIndustry, leadCount);

    const { error: insertError } = await supabase.from("leads").insert(dummyLeads);

    if (insertError) {
      console.error("❌ SUPABASE INSERT ERROR:", insertError);
      return {
        success: false,
        intent: "PULL_LEADS",
        message: "Database rejected the leads.",
        data: object,
      };
    }

    console.log("✅ LEADS SUCCESSFULLY INJECTED");

    const resolvedSlug = client.slug?.trim() ?? normalizeClientSlug(targetClientSlug);
    const workspaceName = client.company_name?.trim() ?? slugToCompanyName(targetClientSlug);

    return {
      success: true,
      intent: "PULL_LEADS",
      message: autoCreated
        ? `Auto-created workspace for ${workspaceName} and staged ${dummyLeads.length} leads.`
        : `Successfully staged ${dummyLeads.length} leads for ${workspaceName}.`,
      data: {
        clientId: client.id,
        slug: resolvedSlug,
        autoCreatedClient: autoCreated,
      },
    };
  }

  return {
    success: false,
    intent: "UNKNOWN",
    message: "Unsupported command intent.",
    data: object,
  };
}
