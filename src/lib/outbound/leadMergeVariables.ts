export type LeadMergeFields = {
  first_name?: string | null;
  last_name?: string | null;
  prospect_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  target_company?: string | null;
  target_role?: string | null;
  title?: string | null;
  role?: string | null;
  email?: string | null;
  pain_point?: string | null;
  industry?: string | null;
};

const MERGE_TAG_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

function firstToken(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export function buildLeadMergeMap(lead: LeadMergeFields): Record<string, string> {
  const prospectName = lead.prospect_name?.trim() || "";
  const firstName =
    lead.first_name?.trim() ||
    firstToken(prospectName) ||
    "there";
  const companyName =
    lead.company_name?.trim() ||
    lead.company?.trim() ||
    lead.target_company?.trim() ||
    "your team";
  const role =
    lead.target_role?.trim() ||
    lead.title?.trim() ||
    lead.role?.trim() ||
    "Leader";

  return {
    first_name: firstName,
    prospect_name: prospectName || firstName,
    last_name: lead.last_name?.trim() || "",
    company_name: companyName,
    company: companyName,
    target_role: role,
    title: role,
    role,
    email: lead.email?.trim() || "",
    pain_point: lead.pain_point?.trim() || "",
    industry: lead.industry?.trim() || "",
  };
}

/** Replace `{{first_name}}`, `{{company_name}}`, etc. with lead field values. */
export function interpolateLeadMergeVariables(
  template: string,
  lead: LeadMergeFields,
): string {
  if (!template.includes("{{")) return template;

  const map = buildLeadMergeMap(lead);
  return template.replace(MERGE_TAG_PATTERN, (_match, key: string) => {
    const normalized = key.toLowerCase();
    return map[normalized] ?? "";
  });
}

export function mergeLeadMergeFields(
  ...sources: Array<LeadMergeFields | null | undefined>
): LeadMergeFields {
  const merged: LeadMergeFields = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        (merged as Record<string, string>)[key] = String(value).trim();
      }
    }
  }
  return merged;
}

export function leadRowToMergeFields(row: Record<string, unknown>): LeadMergeFields {
  const formData =
    row.form_data && typeof row.form_data === "object" && !Array.isArray(row.form_data)
      ? (row.form_data as Record<string, unknown>)
      : {};

  const prospectName =
    typeof row.prospect_name === "string" ? row.prospect_name : null;

  return {
    first_name:
      typeof row.first_name === "string"
        ? row.first_name
        : firstToken(prospectName) || null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    prospect_name: prospectName,
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    company: typeof row.company === "string" ? row.company : null,
    target_company: typeof row.target_company === "string" ? row.target_company : null,
    target_role: typeof row.target_role === "string" ? row.target_role : null,
    title: typeof row.title === "string" ? row.title : null,
    role: typeof row.role === "string" ? row.role : null,
    email: typeof row.email === "string" ? row.email : null,
    pain_point:
      typeof formData.pain_point === "string" ? formData.pain_point : null,
    industry: typeof formData.industry === "string" ? formData.industry : null,
  };
}
