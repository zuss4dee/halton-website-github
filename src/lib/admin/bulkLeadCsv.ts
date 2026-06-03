export type BulkLeadRow = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
};

const HEADER_ALIASES: Record<keyof BulkLeadRow, string[]> = {
  first_name: ["first_name", "firstname", "first", "given_name"],
  last_name: ["last_name", "lastname", "last", "surname", "family_name"],
  email: ["email", "email_address", "work_email"],
  company: ["company", "company_name", "organization", "org"],
  title: ["title", "job_title", "role", "position"],
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
  };

  if (indexes.email < 0) {
    throw new Error('CSV must include an "email" column.');
  }

  const leads: BulkLeadRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const email = (cells[indexes.email] ?? "").trim();
    if (!email) continue;

    leads.push({
      first_name: (indexes.first_name >= 0 ? cells[indexes.first_name] : "")?.trim() || "there",
      last_name: (indexes.last_name >= 0 ? cells[indexes.last_name] : "")?.trim() || "",
      email,
      company: (indexes.company >= 0 ? cells[indexes.company] : "")?.trim() || "their company",
      title: (indexes.title >= 0 ? cells[indexes.title] : "")?.trim() || "Leader",
    });
  }

  return leads;
}
