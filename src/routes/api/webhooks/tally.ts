import { createFileRoute } from "@tanstack/react-router";
import {
  extractEmailFromTallyPayload,
  mapTallyFormData,
  type TallyWebhookPayload,
} from "@/lib/webhooks/tally";
import { createSupabaseServer } from "@/lib/supabase-server";

export const Route = createFileRoute("/api/webhooks/tally")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: TallyWebhookPayload;

        try {
          payload = (await request.json()) as TallyWebhookPayload;
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const email = extractEmailFromTallyPayload(payload);
        if (!email) {
          console.error("[api/webhooks/tally] No email found in payload");
          return Response.json(
            { ok: true, updated: false, reason: "No email field in payload." },
            { status: 200 },
          );
        }

        const formData = mapTallyFormData(payload);
        const now = new Date().toISOString();

        try {
          const supabase = createSupabaseServer();

          const { data: matchingLeads, error: lookupError } = await supabase
            .from("leads")
            .select("id")
            .ilike("email", email)
            .order("created_at", { ascending: false })
            .limit(1);

          if (lookupError) {
            console.error("[api/webhooks/tally] Lead lookup failed:", lookupError);
            return Response.json({ error: "Lead lookup failed." }, { status: 500 });
          }

          const lead = matchingLeads?.[0];
          if (!lead?.id) {
            console.warn("[api/webhooks/tally] No lead found for email:", email);
            return Response.json(
              { ok: true, updated: false, reason: "No matching lead for email." },
              { status: 200 },
            );
          }

          const { error: updateError } = await supabase
            .from("leads")
            .update({
              status: "form_filled",
              is_hot_lead: true,
              form_data: formData,
              last_activity: now,
            })
            .eq("id", lead.id);

          if (updateError) {
            console.error("[api/webhooks/tally] Lead update failed:", updateError);

            // form_data column must exist — see supabase/migrations/20250603120000_leads_form_data.sql
            if (updateError.message?.includes("form_data")) {
              return Response.json(
                {
                  error:
                    "Database missing leads.form_data JSONB column. Run the form_data migration in Supabase.",
                },
                { status: 500 },
              );
            }

            return Response.json({ error: "Lead update failed." }, { status: 500 });
          }

          return Response.json(
            { ok: true, updated: true, leadId: lead.id, email },
            { status: 200 },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Webhook handler failed.";
          console.error("[api/webhooks/tally]", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
