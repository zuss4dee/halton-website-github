import { supabase } from "@/lib/supabase";

export type EmailTemplateRow = {
  id: string;
  client_id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type EmailTemplateInput = {
  clientId: string;
  name: string;
  subject: string;
  body: string;
};

export async function listEmailTemplates(
  clientId: string,
): Promise<{ templates: EmailTemplateRow[] } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  const { data, error } = await supabase
    .from("email_templates")
    .select("id, client_id, name, subject, body, created_at, updated_at")
    .eq("client_id", workspaceClientId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { templates: (data ?? []) as EmailTemplateRow[] };
}

export async function createEmailTemplate(
  input: EmailTemplateInput,
): Promise<{ template: EmailTemplateRow } | { error: string }> {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  const clientId = input.clientId.trim();

  if (!clientId) return { error: "clientId is required." };
  if (!name) return { error: "Template name is required." };
  if (!subject) return { error: "Subject line is required." };

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      client_id: clientId,
      name,
      subject,
      body,
      updated_at: now,
    })
    .select("id, client_id, name, subject, body, created_at, updated_at")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { template: data as EmailTemplateRow };
}

export async function updateEmailTemplate(
  id: string,
  input: Omit<EmailTemplateInput, "clientId">,
): Promise<{ template: EmailTemplateRow } | { error: string }> {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!name) return { error: "Template name is required." };
  if (!subject) return { error: "Subject line is required." };

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name,
      subject,
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, client_id, name, subject, body, created_at, updated_at")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { template: data as EmailTemplateRow };
}

export async function deleteEmailTemplate(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
