export type GlobalNavItem = {
  label: string;
  to: "/admin" | "/admin/vault" | "/admin/logs";
};

export type WorkspaceNavSegment =
  | ""
  | "orchestration"
  | "leads"
  | "outbound"
  | "infrastructure"
  | "workflow"
  | "settings";

export type WorkspaceNavItem = {
  label: string;
  segment: WorkspaceNavSegment;
};

export const GLOBAL_NAV: GlobalNavItem[] = [
  { label: "Index 000 // Tenant Index", to: "/admin" },
  { label: "Index 001 // Global Vault", to: "/admin/vault" },
  { label: "Index 002 // System Logs", to: "/admin/logs" },
];

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "< Return to Global", segment: "" },
  { label: "Workspace 05 // Command Dashboard", segment: "" },
  { label: "Workspace 01 // Orchestration", segment: "orchestration" },
  { label: "Workspace 02 // Lead Pipeline", segment: "leads" },
  { label: "Workspace 03 // Outbound Queue", segment: "outbound" },
  { label: "Workspace 04 // Infrastructure", segment: "infrastructure" },
  { label: "Workspace 06 // SOP Builder", segment: "workflow" },
  { label: "Workspace 07 // Settings", segment: "settings" },
];

export function workspacePath(clientId: string, segment: WorkspaceNavSegment): string {
  if (!segment) return `/admin/client/${clientId}`;
  return `/admin/client/${clientId}/${segment}`;
}
