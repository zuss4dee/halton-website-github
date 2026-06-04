import { companyToSlug } from "@/lib/admin-workspaces";
import type { ClientOnboardInput } from "@/lib/admin/clientsRepository";
import { createSupabaseServer } from "@/lib/supabase-server";

export type OnboardClientPayload = ClientOnboardInput & {
  temporaryPassword: string;
};

export type OnboardClientResult =
  | {
      ok: true;
      clientId: string;
      authUserId: string;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const MIN_PASSWORD_LENGTH = 8;

function normalizePayload(payload: OnboardClientPayload) {
  return {
    companyName: payload.companyName.trim(),
    primaryContactEmail: payload.primaryContactEmail.trim().toLowerCase(),
    targetIcp: payload.targetIcp.trim(),
    coreOffer: payload.coreOffer.trim(),
    sendingDomain: payload.sendingDomain.trim(),
    temporaryPassword: payload.temporaryPassword,
  };
}

export async function onboardClient(
  payload: OnboardClientPayload,
): Promise<OnboardClientResult> {
  const input = normalizePayload(payload);

  if (!input.companyName || !input.primaryContactEmail || !input.sendingDomain) {
    return {
      ok: false,
      error: "Company name, primary contact email, and sending domain are required.",
      status: 400,
    };
  }

  if (input.temporaryPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      status: 400,
    };
  }

  const admin = createSupabaseServer();
  let createdUserId: string | null = null;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.primaryContactEmail,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (authError) {
    const message = authError.message.includes("already been registered")
      ? "A user with this email already exists in Auth."
      : authError.message;
    return { ok: false, error: message, status: 400 };
  }

  const authUser = authData.user;
  if (!authUser?.id) {
    return { ok: false, error: "Auth user was not returned after creation.", status: 500 };
  }

  createdUserId = authUser.id;
  const slug = companyToSlug(input.companyName);

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .insert({
      company_name: input.companyName,
      slug,
      primary_contact_email: input.primaryContactEmail,
      target_icp: input.targetIcp,
      core_offer: input.coreOffer,
      sending_domain: input.sendingDomain,
      owner_user_id: authUser.id,
      monthly_retainer: 1500,
      infrastructure_status: "Nominal",
    })
    .select("id")
    .single();

  if (clientError || !clientRow?.id) {
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return {
      ok: false,
      error: clientError?.message ?? "Failed to create client record.",
      status: 500,
    };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: authUser.id,
      role: "client",
      client_id: clientRow.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await admin.from("clients").delete().eq("id", clientRow.id);
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return {
      ok: false,
      error: profileError.message,
      status: 500,
    };
  }

  return {
    ok: true,
    clientId: clientRow.id,
    authUserId: authUser.id,
  };
}
