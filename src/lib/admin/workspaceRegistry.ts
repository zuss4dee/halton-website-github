export type InfrastructureStatus = "Nominal" | "Scaling" | "Provisioning";
export type RetainerStatus = "Active" | "Unpaid";

export type WorkspaceRegistryEntry = {
  company: string;
  activeAgents: number;
  meetingsBooked: number;
  infrastructureStatus: InfrastructureStatus;
  retainerStatus: RetainerStatus;
  estimatedApiCostGbp: number;
};

export const RETAINER_MRR_GBP = 1500;

export const workspaceRegistry: WorkspaceRegistryEntry[] = [
  {
    company: "Vertex Systems",
    activeAgents: 6,
    meetingsBooked: 34,
    infrastructureStatus: "Nominal",
    retainerStatus: "Active",
    estimatedApiCostGbp: 418,
  },
  {
    company: "Northline Analytics",
    activeAgents: 4,
    meetingsBooked: 21,
    infrastructureStatus: "Nominal",
    retainerStatus: "Active",
    estimatedApiCostGbp: 276,
  },
  {
    company: "Cinder Fintech",
    activeAgents: 8,
    meetingsBooked: 47,
    infrastructureStatus: "Scaling",
    retainerStatus: "Active",
    estimatedApiCostGbp: 642,
  },
  {
    company: "Arbor Security",
    activeAgents: 3,
    meetingsBooked: 12,
    infrastructureStatus: "Provisioning",
    retainerStatus: "Unpaid",
    estimatedApiCostGbp: 0,
  },
  {
    company: "Helix DevTools",
    activeAgents: 5,
    meetingsBooked: 29,
    infrastructureStatus: "Nominal",
    retainerStatus: "Active",
    estimatedApiCostGbp: 384,
  },
];

export function formatGbp(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

export function computeTotalMrr(): number {
  return (
    workspaceRegistry.filter((row) => row.retainerStatus === "Active").length * RETAINER_MRR_GBP
  );
}

export function computeNetMarginGbp(entry: WorkspaceRegistryEntry): number | null {
  if (entry.retainerStatus !== "Active") {
    return null;
  }
  return RETAINER_MRR_GBP - entry.estimatedApiCostGbp;
}
