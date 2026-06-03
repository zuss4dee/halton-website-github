export type GlobalNavItem = {
  label: string;
  to: "/admin" | "/admin/vault" | "/admin/logs" | "/admin/credentials" | "/admin/system";
};

export type WorkspaceNavSegment =
  | "global"
  | "dashboard"
  | "orchestration"
  | "vault"
  | "workflow"
  | "outbound"
  | "settings"
  | "credentials";

export type WorkspaceNavItem = {
  label: string;
  segment: WorkspaceNavSegment;
};

export const GLOBAL_NAV: GlobalNavItem[] = [
  { label: "Index 000 // Tenant Index", to: "/admin" },
  { label: "Index 001 // Global Vault", to: "/admin/vault" },
  { label: "Index 002 // System Logs", to: "/admin/logs" },
  { label: "Index 003 // Credentials", to: "/admin/credentials" },
  { label: "06 // SYSTEM HEALTH", to: "/admin/system" },
];

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "01 // DASHBOARD", segment: "dashboard" },
  { label: "< Return to Global", segment: "global" },
  { label: "02 // CLIENT ASSETS", segment: "vault" },
  { label: "03 // CAMPAIGN RULES", segment: "workflow" },
  { label: "04 // ACTIVE PIPELINE", segment: "outbound" },
  { label: "05 // SETTINGS", segment: "settings" },
  { label: "06 // CREDENTIALS", segment: "credentials" },
];

export function workspacePath(clientId: string, segment: Exclude<WorkspaceNavSegment, "global">): string {
  if (segment === "dashboard") return `/admin/client/${clientId}`;
  return `/admin/client/${clientId}/${segment}`;
}
