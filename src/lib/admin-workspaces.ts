export type ActivityLogEntry = {
  timestamp: string;
  agentType: string;
  actionExecuted: string;
  result: string;
};

export type ApiConnectionStatus = "CONNECTED" | "DISCONNECTED";

export type ClientDomainConfig = {
  domain: string;
  instantly: ApiConnectionStatus;
  apollo: ApiConnectionStatus;
};

export type PipelineActivityRow = {
  date: string;
  prospectName: string;
  targetCompany: string;
  action: string;
};

export type RetainerBadge = "RETAINER_ACTIVE" | "RETAINER_SUSPENDED";

export type Workspace = {
  slug: string;
  company: string;
  activeAgents: number;
  meetingsBooked: number;
  infrastructureStatus: "Nominal" | "Scaling" | "Provisioning";
  monthlyRetainer: number;
  activityLog: ActivityLogEntry[];
  retainerBadge: RetainerBadge;
  netMeetingsSecured: number;
  campaignActiveAgents: number;
  domains: ClientDomainConfig[];
  pipelineActivity: PipelineActivityRow[];
};

export function companyToSlug(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const vertexActivity: ActivityLogEntry[] = [
  {
    timestamp: "2026-05-22 14:32:08 UTC",
    agentType: "Enrichment",
    actionExecuted: "Resolved firmographics for 48 ICP accounts in DACH",
    result: "Complete · 46/48 matched",
  },
  {
    timestamp: "2026-05-22 14:28:41 UTC",
    agentType: "Outbound",
    actionExecuted: "Queued personalised sequences for VP Engineering tier",
    result: "12 sends scheduled",
  },
  {
    timestamp: "2026-05-22 14:19:03 UTC",
    agentType: "Routing",
    actionExecuted: "Booked discovery call — Acme Logistics GmbH",
    result: "Calendar hold · Zurich TZ",
  },
  {
    timestamp: "2026-05-22 14:11:57 UTC",
    agentType: "Telemetry",
    actionExecuted: "Ingested product usage signals from Snowflake warehouse",
    result: "2,140 events normalised",
  },
  {
    timestamp: "2026-05-22 13:58:22 UTC",
    agentType: "Enrichment",
    actionExecuted: "Validated contact emails against bounce threshold",
    result: "Pass · 1.2% risk band",
  },
  {
    timestamp: "2026-05-22 13:44:09 UTC",
    agentType: "Outbound",
    actionExecuted: "Paused sequence batch — duplicate domain detected",
    result: "Held · manual review flagged",
  },
];

const northlineActivity: ActivityLogEntry[] = [
  {
    timestamp: "2026-05-22 14:30:12 UTC",
    agentType: "Enrichment",
    actionExecuted: "Appended technographic tags to 31 target accounts",
    result: "Complete",
  },
  {
    timestamp: "2026-05-22 14:15:44 UTC",
    agentType: "Routing",
    actionExecuted: "Routed inbound reply to AE pod East",
    result: "Assigned · SLA 4h",
  },
  {
    timestamp: "2026-05-22 13:52:01 UTC",
    agentType: "Outbound",
    actionExecuted: "Sent follow-up wave — Series B data teams",
    result: "8 delivered · 0 bounces",
  },
];

const cinderActivity: ActivityLogEntry[] = [
  {
    timestamp: "2026-05-22 14:33:55 UTC",
    agentType: "Telemetry",
    actionExecuted: "Scaled enrichment workers to handle EU volume spike",
    result: "Scaling · 8 → 12 workers",
  },
  {
    timestamp: "2026-05-22 14:22:18 UTC",
    agentType: "Routing",
    actionExecuted: "Booked executive briefing — Nordic Payments AS",
    result: "Confirmed · London calendar",
  },
  {
    timestamp: "2026-05-22 14:08:33 UTC",
    agentType: "Enrichment",
    actionExecuted: "Synced CRM ownership with HubSpot pipeline",
    result: "412 records aligned",
  },
  {
    timestamp: "2026-05-22 13:41:27 UTC",
    agentType: "Outbound",
    actionExecuted: "Launched compliance-approved copy variant B",
    result: "Live · 240 prospects",
  },
];

const arborActivity: ActivityLogEntry[] = [
  {
    timestamp: "2026-05-22 14:27:06 UTC",
    agentType: "Enrichment",
    actionExecuted: "Provisioned subdomain warm-up pool",
    result: "Provisioning · day 2 of 14",
  },
  {
    timestamp: "2026-05-22 14:03:19 UTC",
    agentType: "Telemetry",
    actionExecuted: "Baseline deliverability audit",
    result: "Pending DNS verification",
  },
  {
    timestamp: "2026-05-22 13:36:48 UTC",
    agentType: "Outbound",
    actionExecuted: "Drafted ICP messaging matrix for CISO persona",
    result: "Awaiting client sign-off",
  },
];

const helixActivity: ActivityLogEntry[] = [
  {
    timestamp: "2026-05-22 14:31:40 UTC",
    agentType: "Routing",
    actionExecuted: "Booked technical deep-dive — Stackframe Inc.",
    result: "Complete · NYC calendar",
  },
  {
    timestamp: "2026-05-22 14:18:02 UTC",
    agentType: "Enrichment",
    actionExecuted: "Mapped GitHub org contributors to buying committee",
    result: "19 stakeholders identified",
  },
  {
    timestamp: "2026-05-22 13:55:37 UTC",
    agentType: "Outbound",
    actionExecuted: "Triggered PLG expansion signal outreach",
    result: "5 accounts prioritised",
  },
];

const vertexPipeline: PipelineActivityRow[] = [
  {
    date: "2026-05-22",
    prospectName: "Elena Marsh",
    targetCompany: "Northline Freight Collective",
    action: "Meeting Booked",
  },
  {
    date: "2026-05-21",
    prospectName: "James Calder",
    targetCompany: "HarborGrid Logistics",
    action: "Email Dispatched",
  },
  {
    date: "2026-05-21",
    prospectName: "Priya Nandan",
    targetCompany: "ColdChain Axis",
    action: "Lead Scraped",
  },
  {
    date: "2026-05-20",
    prospectName: "Marcus Holt",
    targetCompany: "Waypoint Haulage",
    action: "Email Dispatched",
  },
];

const northlinePipeline: PipelineActivityRow[] = [
  {
    date: "2026-05-22",
    prospectName: "Tomás Ribeiro",
    targetCompany: "Stackframe Inc.",
    action: "Meeting Booked",
  },
  {
    date: "2026-05-20",
    prospectName: "Sarah Okonkwo",
    targetCompany: "DataMesh Labs",
    action: "Lead Scraped",
  },
];

const cinderPipeline: PipelineActivityRow[] = [
  {
    date: "2026-05-22",
    prospectName: "Nordic Payments AS",
    targetCompany: "Nordic Payments AS",
    action: "Meeting Booked",
  },
  {
    date: "2026-05-21",
    prospectName: "Liam Foster",
    targetCompany: "ClearLedger",
    action: "Email Dispatched",
  },
];

const arborPipeline: PipelineActivityRow[] = [
  {
    date: "2026-05-20",
    prospectName: "CISO Review Pool",
    targetCompany: "ShieldRoute",
    action: "Lead Scraped",
  },
];

const helixPipeline: PipelineActivityRow[] = [
  {
    date: "2026-05-22",
    prospectName: "Stackframe Inc.",
    targetCompany: "Stackframe Inc.",
    action: "Meeting Booked",
  },
  {
    date: "2026-05-19",
    prospectName: "DevRel North",
    targetCompany: "API Forge",
    action: "Email Dispatched",
  },
];

/** Full mock records for client deep-dive routes until those views are database-backed. */
export const mockWorkspaces: Workspace[] = [
  {
    slug: companyToSlug("Vertex Systems"),
    company: "Vertex Systems",
    activeAgents: 6,
    meetingsBooked: 34,
    infrastructureStatus: "Nominal",
    monthlyRetainer: 1500,
    activityLog: vertexActivity,
    retainerBadge: "RETAINER_ACTIVE",
    netMeetingsSecured: 14,
    campaignActiveAgents: 3,
    domains: [
      { domain: "tryvertex.com", instantly: "CONNECTED", apollo: "CONNECTED" },
      { domain: "vertex-outbound.io", instantly: "CONNECTED", apollo: "CONNECTED" },
    ],
    pipelineActivity: vertexPipeline,
  },
  {
    slug: companyToSlug("Northline Analytics"),
    company: "Northline Analytics",
    activeAgents: 4,
    meetingsBooked: 21,
    infrastructureStatus: "Nominal",
    monthlyRetainer: 1500,
    activityLog: northlineActivity,
    retainerBadge: "RETAINER_ACTIVE",
    netMeetingsSecured: 9,
    campaignActiveAgents: 2,
    domains: [{ domain: "northline-hq.com", instantly: "CONNECTED", apollo: "CONNECTED" }],
    pipelineActivity: northlinePipeline,
  },
  {
    slug: companyToSlug("Cinder Fintech"),
    company: "Cinder Fintech",
    activeAgents: 8,
    meetingsBooked: 47,
    infrastructureStatus: "Scaling",
    monthlyRetainer: 1500,
    activityLog: cinderActivity,
    retainerBadge: "RETAINER_ACTIVE",
    netMeetingsSecured: 22,
    campaignActiveAgents: 4,
    domains: [
      { domain: "cinder-pipe.com", instantly: "CONNECTED", apollo: "DISCONNECTED" },
    ],
    pipelineActivity: cinderPipeline,
  },
  {
    slug: companyToSlug("Arbor Security"),
    company: "Arbor Security",
    activeAgents: 3,
    meetingsBooked: 12,
    infrastructureStatus: "Provisioning",
    monthlyRetainer: 1500,
    activityLog: arborActivity,
    retainerBadge: "RETAINER_SUSPENDED",
    netMeetingsSecured: 4,
    campaignActiveAgents: 1,
    domains: [{ domain: "arbor-send.com", instantly: "DISCONNECTED", apollo: "CONNECTED" }],
    pipelineActivity: arborPipeline,
  },
  {
    slug: companyToSlug("Helix DevTools"),
    company: "Helix DevTools",
    activeAgents: 5,
    meetingsBooked: 29,
    infrastructureStatus: "Nominal",
    monthlyRetainer: 1500,
    activityLog: helixActivity,
    retainerBadge: "RETAINER_ACTIVE",
    netMeetingsSecured: 11,
    campaignActiveAgents: 3,
    domains: [{ domain: "helix-growth.dev", instantly: "CONNECTED", apollo: "CONNECTED" }],
    pipelineActivity: helixPipeline,
  },
];

export function getWorkspaceBySlug(slug: string): Workspace | undefined {
  return mockWorkspaces.find((w) => w.slug === slug);
}

/** @deprecated Index 000 loads from Supabase; retained for legacy imports. */
export const workspaces = mockWorkspaces;

export const statusTone: Record<Workspace["infrastructureStatus"], string> = {
  Nominal: "text-ink",
  Scaling: "text-ink-soft",
  Provisioning: "text-ink-soft",
};
