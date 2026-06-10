export type BulkLeadRow = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  /** Company website — preferred research target */
  website?: string;
  /** Any URL useful for research (site, LinkedIn, Crunchbase, etc.) */
  research_url?: string;
  linkedin_url?: string;
};

const HEADER_ALIASES: Record<keyof BulkLeadRow, string[]> = {
  first_name: ["first_name", "firstname", "first", "given_name"],
  last_name: ["last_name", "lastname", "last", "surname", "family_name"],
  email: ["email", "email_address", "work_email"],
  company: ["company", "company_name", "organization", "org"],
  title: ["title", "job_title", "role", "position"],
  website: ["website", "company_website", "domain", "company_domain", "url", "company_url"],
  research_url: ["research_url", "profile_url", "source_url", "link"],
  linkedin_url: ["linkedin_url", "linkedin", "linkedin_profile", "person_linkedin_url"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function resolveColumnIndex(headers: string[], field: keyof BulkLeadRow): number {
  const aliases = HEADER_ALIASES[field];
  return headers.findIndex((header) => aliases.includes(header));
}

function optionalCell(cells: string[], index: number): string | undefined {
  if (index < 0) return undefined;
  const value = (cells[index] ?? "").trim();
  return value || undefined;
}

export function parseBulkLeadCsv(text: string): BulkLeadRow[] {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const indexes = {
    first_name: resolveColumnIndex(headers, "first_name"),
    last_name: resolveColumnIndex(headers, "last_name"),
    email: resolveColumnIndex(headers, "email"),
    company: resolveColumnIndex(headers, "company"),
    title: resolveColumnIndex(headers, "title"),
    website: resolveColumnIndex(headers, "website"),
    research_url: resolveColumnIndex(headers, "research_url"),
    linkedin_url: resolveColumnIndex(headers, "linkedin_url"),
  };

  if (indexes.email < 0) {
    throw new Error('CSV must include an "email" column.');
  }

  const leads: BulkLeadRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const email = (cells[indexes.email] ?? "").trim();
    if (!email) continue;

    const website = optionalCell(cells, indexes.website);
    const research_url = optionalCell(cells, indexes.research_url);
    const linkedin_url = optionalCell(cells, indexes.linkedin_url);

    leads.push({
      first_name: (indexes.first_name >= 0 ? cells[indexes.first_name] : "")?.trim() || "there",
      last_name: (indexes.last_name >= 0 ? cells[indexes.last_name] : "")?.trim() || "",
      email,
      company: (indexes.company >= 0 ? cells[indexes.company] : "")?.trim() || "their company",
      title: (indexes.title >= 0 ? cells[indexes.title] : "")?.trim() || "Leader",
      ...(website ? { website } : {}),
      ...(research_url ? { research_url } : {}),
      ...(linkedin_url ? { linkedin_url } : {}),
    });
  }

  return leads;
}
