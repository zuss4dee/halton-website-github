export type StreamStatus = "PULLING" | "IDLE";

export type IngestionStream = {
  id: string;
  workspace: string;
  title: string;
  geo: string;
  status: StreamStatus;
};

export const INGESTION_STREAMS: IngestionStream[] = [
  {
    id: "stream-01",
    workspace: "Vertex Systems",
    title: "COO",
    geo: "UK",
    status: "PULLING",
  },
  {
    id: "stream-02",
    workspace: "LogisticsOS",
    title: "VP Supply Chain",
    geo: "London",
    status: "IDLE",
  },
];

export type EmailStatus = "VERIFIED" | "RISKY";
export type EnrichmentStatus = "PENDING_SCRAPE" | "SCRAPING..." | "ENRICHED" | "SKIPPED";

export type StagedLead = {
  id: string;
  clientId?: string;
  name: string;
  title: string;
  company: string;
  emailStatus: EmailStatus;
  enrichment: EnrichmentStatus;
};

export const STAGED_LEADS: StagedLead[] = [
  {
    id: "lead-01",
    name: "Elena Marsh",
    title: "Director of Fleet Operations",
    company: "Northline Freight Collective",
    emailStatus: "VERIFIED",
    enrichment: "PENDING_SCRAPE",
  },
  {
    id: "lead-02",
    name: "Tomás Ribeiro",
    title: "VP Supply Chain",
    company: "HarborGrid Logistics",
    emailStatus: "RISKY",
    enrichment: "PENDING_SCRAPE",
  },
  {
    id: "lead-03",
    name: "Priya Nandan",
    title: "Head of Procurement",
    company: "ColdChain Axis",
    emailStatus: "VERIFIED",
    enrichment: "SKIPPED",
  },
  {
    id: "lead-04",
    name: "Marcus Holt",
    title: "COO",
    company: "Waypoint Haulage",
    emailStatus: "VERIFIED",
    enrichment: "PENDING_SCRAPE",
  },
];
