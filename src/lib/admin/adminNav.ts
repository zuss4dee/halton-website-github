export type GlobalNavItem = {
  label: string;
  to: "/admin" | "/admin/inbox" | "/admin/domains";
};

export type WorkspaceNavSegment =
  | "global"
  | "dashboard"
  | "leads"
  | "orchestration"
  | "vault"
  | "workflow"
  | "sequence"
  | "templates"
  | "outbound"
  | "settings"
  | "credentials";

export type WorkspaceNavItem = {
  label: string;
  segment: WorkspaceNavSegment;
};

export const GLOBAL_NAV: GlobalNavItem[] = [
  { label: "00 // ALL CLIENTS", to: "/admin" },
  { label: "01 // UNIFIED_INBOX", to: "/admin/inbox" },
  { label: "02 // DOMAIN_FLEET", to: "/admin/domains" },
];

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "01 // DASHBOARD", segment: "dashboard" },
  { label: "01b // LEADS CRM", segment: "leads" },
  { label: "< Return to Global", segment: "global" },
  { label: "02 // CLIENT ASSETS", segment: "vault" },
  { label: "03 // CAMPAIGN RULES", segment: "workflow" },
  { label: "03a // AUTOMATED_SEQUENCE", segment: "sequence" },
  { label: "03b // COPY_LIBRARY", segment: "templates" },
  { label: "04 // ACTIVE PIPELINE", segment: "outbound" },
  { label: "05 // SETTINGS", segment: "settings" },
  { label: "06 // CREDENTIALS", segment: "credentials" },
];

export function workspacePath(
  clientId: string,
  segment: Exclude<WorkspaceNavSegment, "global">,
): string {
  if (segment === "dashboard") return `/admin/client/${clientId}`;
  if (segment === "orchestration") return `/admin/client/${clientId}/orchestration`;
  return `/admin/client/${clientId}/${segment}`;
}
