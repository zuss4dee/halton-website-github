import { generateObject } from "ai";
import { z } from "zod";

import { deepseek } from "./providers";

const coldEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type ColdEmailDraft = z.infer<typeof coldEmailSchema>;

export async function generateColdEmail(lead: unknown, client: unknown): Promise<ColdEmailDraft> {
  const leadRecord = lead as Record<string, unknown>;
  const clientRecord = client as Record<string, unknown>;

  const leadName = String(leadRecord.name ?? leadRecord.prospect_name ?? "the prospect");
  const leadRole = String(leadRecord.title ?? leadRecord.target_role ?? "their role");
  const leadCompany = String(leadRecord.company ?? leadRecord.target_company ?? "their company");
  const clientName = String(clientRecord.company_name ?? clientRecord.company ?? "our client");
  const clientSlug = String(clientRecord.slug ?? "");

  const { object } = await generateObject({
    model: deepseek("deepseek-chat"),
    schema: coldEmailSchema,
    system:
      "You are an elite B2B copywriter. Write a short, punchy, text-only cold email (under 75 words). No fluff. Connect the lead's role and company to our client's offering. Use line breaks for readability.",
    prompt: [
      `Prospect: ${leadName}`,
      `Role: ${leadRole}`,
      `Company: ${leadCompany}`,
      `Our client: ${clientName}${clientSlug ? ` (${clientSlug})` : ""}`,
      "Write a personalized cold email subject line and body.",
    ].join("\n"),
  });

  return object;
}
