import { supabase } from "@/lib/supabase";

export type SendApprovedLeadInput = {
  clientId: string;
  leadId: string;
  email: string;
  body: string;
  subject?: string;
};

export async function sendApprovedLeadEmail(
  input: SendApprovedLeadInput,
): Promise<{ success: boolean; error?: string }> {
  const clientId = input.clientId.trim();
  const email = input.email.trim();
  const body = input.body.trim();

  if (!clientId || !email || !body) {
    return { success: false, error: "Missing clientId, email, or body" };
  }

  const subject =
    input.subject?.trim() ||
    `Quick question for ${email.split("@")[1] ?? "your team"}`;

  const { data, error } = await supabase.functions.invoke("run-outbound", {
    body: {
      clientId,
      sendApproved: true,
      leadId: input.leadId,
      email,
      body,
      subject,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const payload = data as { error?: string; success?: boolean } | null;
  if (payload?.error) {
    return { success: false, error: payload.error };
  }

  return { success: payload?.success !== false };
}
