import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

const EMPTY_ONBOARD_FORM = {
  companyName: "",
  primaryContactEmail: "",
  temporaryPassword: "",
  targetIcp: "",
  coreOffer: "",
  sendingDomain: "",
};

type OnboardFormState = typeof EMPTY_ONBOARD_FORM;

const fieldLabelClassName = "mb-2 block text-sm font-medium text-gray-700";

const inputClassName =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50";

const textareaClassName =
  "min-h-[120px] w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50";

function formatStatusLabel(row: ClientRow): string {
  const status = row.infrastructure_status?.trim();
  if (!status) return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatIndustry(row: ClientRow): string {
  const industry = row.industry?.trim();
  return industry || "General";
}

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "scaling") return "bg-violet-50 text-violet-700";
  if (normalized === "provisioning") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

const commandActionClassName =
  "inline-block border border-gray-900 bg-white px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-gray-900 transition-colors hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

function GlobalLobby() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<OnboardFormState>(EMPTY_ONBOARD_FORM);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOBBY FETCH ERROR:", error);
      setClients([]);
    } else if (data) {
      setClients(data as ClientRow[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const updateField = (field: keyof OnboardFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setOnboardError(null);
  };

  const isFormValid =
    form.companyName.trim().length > 0 &&
    form.primaryContactEmail.trim().length > 0 &&
    form.temporaryPassword.length >= 8 &&
    form.sendingDomain.trim().length > 0;

  const handleOnboardClient = async () => {
    const companyName = form.companyName.trim();
    const primaryContactEmail = form.primaryContactEmail.trim();
    const temporaryPassword = form.temporaryPassword;
    const targetIcp = form.targetIcp.trim();
    const coreOffer = form.coreOffer.trim();
    const sendingDomain = form.sendingDomain.trim();

    if (
      !companyName ||
      !primaryContactEmail ||
      !temporaryPassword ||
      !sendingDomain ||
      isOnboarding
    ) {
      setOnboardError(
        "Company name, contact email, temporary password (8+ chars), and sending domain are required.",
      );
      return;
    }

    setIsOnboarding(true);
    setOnboardError(null);

    try {
      const response = await fetch("/api/admin/onboard-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName,
          primaryContactEmail,
          temporaryPassword,
          targetIcp,
          coreOffer,
          sendingDomain,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setOnboardError(payload.error ?? "Onboarding failed.");
      } else {
        setForm(EMPTY_ONBOARD_FORM);
        await fetchClients();
      }
    } catch (error) {
      console.error("ONBOARD ERROR:", error);
      setOnboardError(
        error instanceof Error ? error.message : "Onboarding request failed.",
      );
    }

    setIsOnboarding(false);
  };

  return (
    <section className="space-y-10">
      <header className="border-b border-gray-200 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
        <p className="mt-2 text-sm text-gray-500">
          Onboard client workspaces and open active tenant directories.
        </p>
      </header>

      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Onboard Client</h2>
          <p className="mt-1 text-sm text-gray-500">
            Provision a new workspace with ICP, offer, and sending domain defaults.
          </p>
        </div>

        <form
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void handleOnboardClient();
          }}
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="onboard-company-name" className={fieldLabelClassName}>
                Company Name
              </label>
              <input
                id="onboard-company-name"
                type="text"
                value={form.companyName}
                onChange={(event) => updateField("companyName", event.target.value)}
                disabled={isOnboarding}
                placeholder="Acme Logistics Ltd"
                className={inputClassName}
                autoComplete="organization"
              />
            </div>

            <div>
              <label htmlFor="onboard-contact-email" className={fieldLabelClassName}>
                Primary Contact Email
              </label>
              <input
                id="onboard-contact-email"
                type="email"
                value={form.primaryContactEmail}
                onChange={(event) => updateField("primaryContactEmail", event.target.value)}
                disabled={isOnboarding}
                placeholder="founder@acme.com"
                className={inputClassName}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="onboard-temporary-password" className={fieldLabelClassName}>
                Temporary Password
              </label>
              <input
                id="onboard-temporary-password"
                type="text"
                value={form.temporaryPassword}
                onChange={(event) => updateField("temporaryPassword", event.target.value)}
                disabled={isOnboarding}
                placeholder="Min. 8 characters — share securely with client"
                className={inputClassName}
                autoComplete="new-password"
                spellCheck={false}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Creates the Supabase Auth login for this email. Client should change it after first sign-in.
              </p>
            </div>

            <div>
              <label htmlFor="onboard-target-icp" className={fieldLabelClassName}>
                Target ICP
              </label>
              <textarea
                id="onboard-target-icp"
                value={form.targetIcp}
                onChange={(event) => updateField("targetIcp", event.target.value)}
                disabled={isOnboarding}
                placeholder="Titles, industries, company size, geography, and buying triggers."
                className={textareaClassName}
              />
            </div>

            <div>
              <label htmlFor="onboard-core-offer" className={fieldLabelClassName}>
                Core Offer
              </label>
              <textarea
                id="onboard-core-offer"
                value={form.coreOffer}
                onChange={(event) => updateField("coreOffer", event.target.value)}
                disabled={isOnboarding}
                placeholder="What you sell, outcome promised, and proof points for outbound copy."
                className={textareaClassName}
              />
            </div>

            <div>
              <label htmlFor="onboard-sending-domain" className={fieldLabelClassName}>
                Sending Domain
              </label>
              <input
                id="onboard-sending-domain"
                type="text"
                value={form.sendingDomain}
                onChange={(event) => updateField("sendingDomain", event.target.value)}
                disabled={isOnboarding}
                placeholder="outbound.acme.com"
                className={inputClassName}
                autoComplete="off"
              />
            </div>
          </div>

          {onboardError ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {onboardError}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={!isFormValid || isOnboarding}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isOnboarding ? "Provisioning…" : "ONBOARD"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Client Directory</h2>
          <p className="mt-1 text-sm text-gray-500">
            Active workspaces — open any client to manage agents, pipeline, and assets.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Company
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Contact
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Sending Domain
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Industry
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                      Loading clients…
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                      No clients yet. Onboard your first workspace above.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => {
                    const statusLabel = formatStatusLabel(client);

                    return (
                      <tr
                        key={client.id ?? client.slug}
                        className="border-b border-gray-50 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <span className="block font-medium text-gray-900">
                            {client.company_name ?? "—"}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-400">
                            {client.slug ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {client.primary_contact_email?.trim() || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {client.sending_domain?.trim() || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-600">{formatIndustry(client)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(statusLabel)}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {client.id ? (
                              <>
                                <Link
                                  to="/admin/client/$id"
                                  params={{ id: client.id }}
                                  className={commandActionClassName}
                                >
                                  [ Manage Campaigns ]
                                </Link>
                                <a
                                  href={`/workspace/${client.id}`}
                                  className={commandActionClassName}
                                >
                                  [ View As Client ]
                                </a>
                              </>
                            ) : (
                              <span className={`${commandActionClassName} opacity-40`}>
                                [ Unavailable ]
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}

export function AdminCommandCenter() {
  return (
    <div className="min-h-[60vh]">
      <GlobalLobby />
    </div>
  );
}
