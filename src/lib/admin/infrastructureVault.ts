export type DnsStatus = "VERIFIED" | "FAILING";

export type MasterApiPipe = {
  id: string;
  label: string;
};

export const MASTER_API_PIPES: MasterApiPipe[] = [
  { id: "apollo", label: "Apollo API Key" },
  { id: "firecrawl", label: "Firecrawl API Key" },
  { id: "instantly", label: "Instantly API Key" },
  { id: "vercel-ai", label: "Vercel AI SDK" },
];

export type OutboundDomain = {
  domain: string;
  workspaceAssigned: string;
  spf: DnsStatus;
  dkim: DnsStatus;
  dmarc: DnsStatus;
};

export const OUTBOUND_DOMAINS: OutboundDomain[] = [
  {
    domain: "tryhaltonworks.com",
    workspaceAssigned: "Internal Outbound",
    spf: "VERIFIED",
    dkim: "VERIFIED",
    dmarc: "VERIFIED",
  },
  {
    domain: "haltonworkshq.com",
    workspaceAssigned: "Vertex Systems",
    spf: "VERIFIED",
    dkim: "FAILING",
    dmarc: "VERIFIED",
  },
  {
    domain: "gethalton.works",
    workspaceAssigned: "Northline Analytics",
    spf: "VERIFIED",
    dkim: "VERIFIED",
    dmarc: "FAILING",
  },
  {
    domain: "halton-outbound.io",
    workspaceAssigned: "Cinder Fintech",
    spf: "FAILING",
    dkim: "VERIFIED",
    dmarc: "VERIFIED",
  },
];

export const INFRASTRUCTURE_METRICS = {
  totalActiveInboxes: 6,
  dailyPoolCapacity: 240,
} as const;
