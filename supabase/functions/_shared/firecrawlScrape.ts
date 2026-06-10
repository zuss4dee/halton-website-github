export async function scrapeUrlWithFirecrawl(
  apiKey: string,
  url: string,
): Promise<{ markdown: string; title?: string }> {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firecrawl scrape failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data?: { markdown?: string; metadata?: { title?: string } };
  };

  const markdown = payload.data?.markdown?.trim() ?? "";
  if (!markdown) {
    throw new Error("Firecrawl returned empty markdown for URL");
  }

  return {
    markdown,
    title: payload.data?.metadata?.title,
  };
}

export function normalizeResearchUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  if (/linkedin\.com\//i.test(trimmed) || /twitter\.com\//i.test(trimmed) || /x\.com\//i.test(trimmed)) {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
  }

  return null;
}

export function pickResearchUrlFromLead(lead: Record<string, unknown>): string {
  for (const key of ["website", "research_url", "company_url", "linkedin_url", "linkedin"]) {
    const value = lead[key];
    if (typeof value === "string" && value.trim()) {
      const normalized = normalizeResearchUrl(value);
      if (normalized) return normalized;
    }
  }
  return "";
}
