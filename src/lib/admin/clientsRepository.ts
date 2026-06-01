import { companyToSlug, type Workspace } from "@/lib/admin-workspaces";

export type WorkspaceListItem = Pick<
  Workspace,
  "slug" | "company" | "activeAgents" | "meetingsBooked" | "infrastructureStatus"
>;

export type ClientRow = {
  id?: string;
  slug?: string | null;
  company_name?: string | null;
  industry?: string | null;
  monthly_retainer?: number | null;
  active_agents?: number | null;
  meetings_booked?: number | null;
  infrastructure_status?: string | null;
  core_offer?: string | null;
  target_icp?: string | null;
  case_studies?: string | null;
  tone_of_voice?: string | null;
  created_at?: string | null;
};

function normalizeInfrastructureStatus(
  value: string | null | undefined,
): Workspace["infrastructureStatus"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "scaling") return "Scaling";
  if (normalized === "provisioning") return "Provisioning";
  return "Nominal";
}

export function mapClientRowToWorkspaceListItem(row: ClientRow): WorkspaceListItem | null {
  const company = row.company_name?.trim();
  if (!company) return null;

  const slug = row.slug?.trim() || companyToSlug(company);

  return {
    slug,
    company,
    activeAgents: row.active_agents ?? 0,
    meetingsBooked: row.meetings_booked ?? 0,
    infrastructureStatus: normalizeInfrastructureStatus(row.infrastructure_status),
  };
}
