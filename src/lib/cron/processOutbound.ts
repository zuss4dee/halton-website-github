import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  resolveClientFromEmail,
  type ClientSendingConfig,
} from "@/lib/outbound/resolveClientFromEmail";

let supabaseClient: ReturnType<typeof createClient> | undefined;
let resendClient: Resend | undefined;

function getCronSupabase() {
  if (!supabaseClient) {
    const supabaseUrl =
      process.env.SUPABASE_URL?.trim() ||
      process.env.VITE_SUPABASE_URL?.trim() ||
      "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for outbound cron.",
      );
    }
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
}

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

async function loadClientSendingConfig(
  clientId: string,
  cache: Map<string, ClientSendingConfig | null>,
): Promise<ClientSendingConfig | null> {
  if (cache.has(clientId)) {
    return cache.get(clientId) ?? null;
  }

  const { data, error } = await getCronSupabase()
    .from("clients")
    .select("company_name, sending_domain")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error(`[cron/process-outbound] Client lookup failed for ${clientId}:`, error);
    cache.set(clientId, null);
    return null;
  }

  const config = (data as ClientSendingConfig | null) ?? null;
  cache.set(clientId, config);
  return config;
}

export async function processOutboundQueue(options?: { clientId?: string }) {
  const now = new Date().toISOString();
  const scopedClientId = options?.clientId?.trim();

  let leadsQuery = getCronSupabase()
    .from("leads")
    .select("*")
    .eq("queue_status", "active")
    .lte("next_send_date", now);

  if (scopedClientId) {
    leadsQuery = leadsQuery.eq("client_id", scopedClientId);
  }

  const { data: leads, error: leadsError } = await leadsQuery.limit(100);

  if (leadsError) throw leadsError;
  if (!leads || leads.length === 0) {
    return { processed: 0, ...(scopedClientId ? { clientId: scopedClientId } : {}) };
  }

  const clientConfigCache = new Map<string, ClientSendingConfig | null>();
  let processedCount = 0;

  for (const lead of leads) {
    try {
      const { data: sequenceStep, error: seqError } = await getCronSupabase()
        .from("campaign_sequences")
        .select("*")
        .eq("client_id", lead.client_id)
        .eq("step_number", lead.current_sequence_step)
        .single();

      if (seqError || !sequenceStep) {
        console.error(
          `No sequence step ${lead.current_sequence_step} found for client ${lead.client_id}`,
        );
        continue;
      }

      const clientId = lead.client_id as string | null;
      if (!clientId) {
        console.error(`Lead ${lead.id} is missing client_id.`);
        continue;
      }

      const clientConfig = await loadClientSendingConfig(clientId, clientConfigCache);
      if (!clientConfig) {
        console.error(`No tenant record found for client ${clientId} (lead ${lead.id}).`);
        continue;
      }

      const fromEmail = resolveClientFromEmail(clientConfig);
      if (!fromEmail) {
        console.error(
          `No from address for client ${clientId} (${clientConfig.company_name ?? "unknown"}): set sending_domain or RESEND_FROM_EMAIL.`,
        );
        continue;
      }

      const firstName = lead.first_name || lead.prospect_name || "there";
      const companyName = lead.company_name || lead.company || lead.target_company || "";

      const personalizedSubject = sequenceStep.subject
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{prospect_name}}/g, firstName)
        .replace(/{{company_name}}/g, companyName)
        .replace(/{{company}}/g, companyName);

      const personalizedBody = sequenceStep.body
        .replace(/{{first_name}}/g, firstName)
        .replace(/{{prospect_name}}/g, firstName)
        .replace(/{{company_name}}/g, companyName)
        .replace(/{{company}}/g, companyName);

      const emailResponse = await getResend().emails.send({
        from: fromEmail,
        to: lead.email,
        subject: personalizedSubject,
        text: personalizedBody,
      });

      if (emailResponse.error) {
        console.error(`Resend failed for lead ${lead.id}:`, emailResponse.error);
        continue;
      }

      const { data: nextStep } = await getCronSupabase()
        .from("campaign_sequences")
        .select("delay_days")
        .eq("client_id", lead.client_id)
        .eq("step_number", lead.current_sequence_step + 1)
        .single();

      if (nextStep) {
        const nextSendDate = new Date();
        nextSendDate.setDate(nextSendDate.getDate() + nextStep.delay_days);
        await getCronSupabase()
          .from("leads")
          .update({
            current_sequence_step: lead.current_sequence_step + 1,
            next_send_date: nextSendDate.toISOString(),
          })
          .eq("id", lead.id);
      } else {
        await getCronSupabase()
          .from("leads")
          .update({
            queue_status: "completed",
            next_send_date: null,
          })
          .eq("id", lead.id);
      }
      processedCount++;
    } catch (innerError) {
      console.error(`Error processing lead ${lead.id}:`, innerError);
    }
  }
  return {
    processed: processedCount,
    ...(scopedClientId ? { clientId: scopedClientId } : {}),
  };
}
