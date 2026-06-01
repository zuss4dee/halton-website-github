export type AdminViewId = "global" | "infrastructure" | "scratchpad" | "prompt" | "logs";

export type AdminNavItem = {
  id: AdminViewId;
  label: string;
  placeholderTitle?: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "global", label: "Index 000 // Global Command" },
  {
    id: "infrastructure",
    label: "Index 001 // Infrastructure Vault",
    placeholderTitle: "INFR_VAULT // 001",
  },
  {
    id: "scratchpad",
    label: "Index 002 // Lead Scratchpad",
    placeholderTitle: "LEAD_SCRATCH // 002",
  },
  {
    id: "prompt",
    label: "Index 003 // Prompt Labs",
    placeholderTitle: "PROMPT_LABS // 003",
  },
  {
    id: "logs",
    label: "Index 004 // Execution Logs",
    placeholderTitle: "EXEC_LOGS // 004",
  },
];

export function getAdminNavItem(id: AdminViewId) {
  return ADMIN_NAV_ITEMS.find((item) => item.id === id);
}
